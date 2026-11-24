import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createApp} from '../server/app.mjs';
import {createSession, recoveryCode, normalizeCode, hash, now} from '../server/access.mjs';
import {checkoutOptions, checkoutReady, fulfill, handlePaymentEvent} from '../server/payments.mjs';
function setup() {
 const db=new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('../migrations/0001_passes.sql',import.meta.url),'utf8'));
 const DB={prepare(sql){let values=[];return {bind(...v){values=v;return this},async first(){return db.prepare(sql).get(...values)||null},async run(){return db.prepare(sql).run(...values)}}},async batch(stmts){db.exec('BEGIN');try {const rows=[];for(const s of stmts) rows.push(await s.run());db.exec('COMMIT');return rows}catch(e){db.exec('ROLLBACK');throw e}}};
 const env={DB,APP_ORIGIN:'https://app.example',RATE_LIMIT_SALT:'test-only-salt',STRIPE_MODE:'test',TAX_MODE:'none',STRIPE_PRICE_ID:'price_test',STRIPE_API_KEY:'test-placeholder',STRIPE_WEBHOOK_SECRET:'test-placeholder',ASSETS:{fetch:async()=>new Response('asset')}};
 const questions=[{id:'free',t:'basics',q:'free lesson'},{id:'paid',t:'lines',q:'premium lesson'}];
 const app=createApp({questions,makeStripe:()=>({}),verifyEvent:async()=>{throw Error('bad signature')}});
 const req=(path,method='GET',cookie='',body)=>app.fetch(new Request(env.APP_ORIGIN+path,{method,headers:{Origin:env.APP_ORIGIN,Cookie:cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
 const identity=async()=>{const id=crypto.randomUUID();db.prepare('INSERT INTO identities(id,created_at) VALUES(?,?)').run(id,now());return {id,cookie:(await createSession(id,env)).split(';')[0]}};
 const grant=id=>db.prepare("INSERT INTO grants VALUES(?,?,'complimentary','active',?)").run(crypto.randomUUID(),id,now());
 return {db,env,req,identity,grant,app};
}
test('free bootstrap never includes premium content, even with forged cookie or absent setup',async()=>{
 const {req,app}=setup();for(const cookie of ['', '__Host-ort_session='+ 'a'.repeat(64)]) {const r=await req('/api/bootstrap','GET',cookie);const b=await r.json();assert.deepEqual(b.questions.map(q=>q.id),['free']);assert.equal(b.pass.active,false)}
 const b=await(await app.fetch(new Request('https://app.example/api/bootstrap'),{})).json();assert.equal(b.questions.length,1);assert.equal(b.checkoutAvailable,false);
});
test('private source paths and old public question bundles are denied',async()=>{const {req}=setup();for(const p of ['/js/questions.js','/js/questions-more.js?v=1','/server/question-bank.mjs','/.dev.vars','/migrations/0001_passes.sql'])assert.equal((await req(p)).status,404);assert.equal((await req('/js/game.js')).status,200)});
test('active grant unlocks content, expired session does not',async()=>{const {req,identity,grant,db}=setup();const {id,cookie}=await identity();grant(id);assert.equal((await(await req('/api/bootstrap','GET',cookie)).json()).questions.length,2);db.exec('UPDATE sessions SET expires_at=0');assert.equal((await(await req('/api/bootstrap','GET',cookie)).json()).questions.length,1)});
test('cross origin mutations rejected',async()=>{const {app,env}=setup();const r=await app.fetch(new Request(env.APP_ORIGIN+'/api/recovery/restore',{method:'POST',headers:{Origin:'https://other.example'},body:'{}'}),env);assert.equal(r.status,403)});
test('recovery code restores only active pass, stores hash, rotates old code',async()=>{
 const {req,identity,grant,db}=setup();const {id,cookie}=await identity();assert.equal((await req('/api/recovery/issue','POST',cookie)).status,403);grant(id);
 const code=(await(await req('/api/recovery/issue','POST',cookie)).json()).code;assert.ok(normalizeCode(code));assert.equal(db.prepare('SELECT recovery_hash FROM identities WHERE id=?').get(id).recovery_hash,await hash(normalizeCode(code)));
 const restored=await req('/api/recovery/restore','POST','',{code:code.toLowerCase()});assert.equal(restored.status,200);assert.match(restored.headers.get('Set-Cookie'),/HttpOnly.*Secure/);
 await req('/api/recovery/issue','POST',cookie);assert.equal((await req('/api/recovery/restore','POST','',{code})).status,400);
 db.exec("UPDATE grants SET status='revoked'");assert.equal((await(await req('/api/bootstrap','GET',cookie)).json()).pass.active,false);
});
test('restore attempts rate limited and webhook invalid signature rejected',async()=>{const {req}=setup();for(let i=0;i<10;i++)assert.equal((await req('/api/recovery/restore','POST','',{code:'bad'})).status,400);assert.equal((await req('/api/recovery/restore','POST','',{code:'bad'})).status,429);assert.equal((await req('/api/stripe/webhook','POST','',{})).status,400)});
test('no tax configuration is explicit, no payment methods hardcoded',()=>{const {env}=setup();assert.ok(checkoutReady(env));const o=checkoutOptions(env,'id');assert.equal(o.line_items[0].tax_rates,undefined);assert.equal(o.automatic_tax,undefined);assert.equal(o.payment_method_types,undefined);assert.throws(()=>checkoutOptions({...env,TAX_MODE:undefined},'id'));for(let i=0;i<50;i++)assert.ok(normalizeCode(recoveryCode()))});
function paidSession(id){return {id:'cs_test',metadata:{app:'oahu-road-trip',identity_id:id},client_reference_id:id,livemode:false,mode:'payment',payment_status:'paid',currency:'usd',amount_subtotal:999,amount_total:999,line_items:{has_more:false,data:[{quantity:1,price:{id:'price_test',unit_amount:999,currency:'usd',tax_behavior:'exclusive'}}]},payment_intent:{id:'pi_test',status:'succeeded',metadata:{app:'oahu-road-trip',identity_id:id},latest_charge:{refunded:false,disputed:false}}}}
test('only verified paid order grants access; replay and refund cannot reactivate',async()=>{
 const {env,db,identity}=setup();const {id}=await identity();db.prepare('INSERT INTO checkout_attempts VALUES(?,?,?)').run('cs_test',id,now());const s=paidSession(id);const stripe={checkout:{sessions:{retrieve:async()=>s}},charges:{retrieve:async()=>({payment_intent:'pi_test',refunded:true})},paymentIntents:{retrieve:async()=>({id:'pi_test',livemode:false,metadata:{app:'oahu-road-trip'}})}};
 s.payment_status='unpaid';await fulfill(s.id,env,stripe);assert.equal(db.prepare('SELECT COUNT(*) n FROM grants').get().n,0);
 s.payment_status='paid';s.amount_subtotal=998;await assert.rejects(fulfill(s.id,env,stripe));s.amount_subtotal=999;
 await fulfill(s.id,env,stripe);await fulfill(s.id,env,stripe);assert.equal(db.prepare('SELECT COUNT(*) n FROM grants').get().n,1);assert.equal(db.prepare('SELECT status FROM grants').get().status,'active');
 await handlePaymentEvent({livemode:false,type:'charge.refunded',data:{object:{id:'ch_test'}}},env,stripe);await fulfill(s.id,env,stripe);assert.equal(db.prepare('SELECT status FROM grants').get().status,'revoked');
});
test('out of order refund prevents later entitlement',async()=>{const {env,db,identity}=setup();const {id}=await identity();db.prepare('INSERT INTO checkout_attempts VALUES(?,?,?)').run('cs_test',id,now());db.prepare('INSERT INTO payment_blocks VALUES(?,?,?)').run('pi_test','revoked',now());await fulfill('cs_test',env,{checkout:{sessions:{retrieve:async()=>paidSession(id)}}});assert.equal(db.prepare('SELECT status FROM grants').get().status,'revoked')});
test('checkout binds validated test price to a private browser session',async()=>{
 const {env,db}=setup();let options;
 const app=createApp({questions:[],makeStripe:()=>({prices:{retrieve:async()=>({active:true,type:'one_time',unit_amount:999,currency:'usd',tax_behavior:'exclusive',livemode:false})},checkout:{sessions:{create:async o=>{options=o;return {id:'cs_created',url:'https://checkout.stripe.com/c/pay/test'}}}}}),verifyEvent:async()=>{}});
 const response=await app.fetch(new Request(env.APP_ORIGIN+'/api/checkout',{method:'POST',headers:{Origin:env.APP_ORIGIN},body:'{}'}),env);
 assert.equal(response.status,200);assert.match(response.headers.get('Set-Cookie'),/HttpOnly/);assert.equal(db.prepare('SELECT identity_id FROM checkout_attempts').get().identity_id,options.client_reference_id);assert.equal(options.line_items[0].price,'price_test');assert.equal(options.automatic_tax,undefined);
});
