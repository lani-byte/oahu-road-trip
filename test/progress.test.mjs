import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function audit() {
 const c={window:{matchMedia:()=>({matches:true})},document:{getElementById:()=>({}),documentElement:{classList:{add(){}}}},localStorage:{getItem:()=>null,setItem(){}},console,Date,Set,Map,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')};vm.createContext(c);
 for(const f of ['signs.js','questions.js','questions-more.js'])vm.runInContext(readFileSync(new URL('../js/'+f,import.meta.url),'utf8'),c);
 let game=readFileSync(new URL('../js/game.js',import.meta.url),'utf8');game=game.slice(0,game.indexOf('  // Boot'))+`window.audit={refreshCorrectedContent,readiness,sourceHTML,makeCode,readCode,unlocked,setProfile(p){store.profiles={test:p};store.active="test";},setAccess(a){access=a},initialize(){TOPIC_IDS={};for(const q of window.ORT_QUESTIONS)(TOPIC_IDS[q.t]||=[]).push(q.id);KNOWN_Q_IDS=new Set(Object.values(TOPIC_IDS).flat());Q=window.ORT_QUESTIONS.filter(q=>q.t==='basics');QBY=Object.fromEntries(Q.map(q=>[q.id,q]));}};})();`;vm.runInContext(game,c);c.window.audit.initialize();return c.window;
}
test('premium progress survives free-mode save and restore without granting paid access',()=>{
 const w=audit(),a=w.audit;const p={name:'TestDriver',color:'#ff5a5f',xp:200,streak:1,lastDay:0,best:{kapolei:3,pearl:2},cards:{l1:{box:3,due:100,r:3,w:0}},badges:[],otBest:0,permitBest:null,permitTries:0,permitHist:[],pits:0,answered:3,right:3};a.setProfile(p);const restored=a.readCode(a.makeCode(p));assert.equal(restored.cards.l1.box,3);assert.equal(restored.best.pearl,2);assert.equal(a.unlocked(1),false);a.setAccess({active:true,owner:false});assert.equal(a.unlocked(1),true);
});
test('accuracy migration preserves prior corrected question and requires mastery in every topic',()=>{
 const w=audit(),a=w.audit;const cards=Object.fromEntries(w.ORT_QUESTIONS.map(q=>[q.id,{box:3,due:99,r:3,w:1}]));const p={cards,best:{kapolei:3},permitHist:[30,30],xp:200};a.setProfile(p);a.refreshCorrectedContent(p);assert.equal(cards.a14.box,0);assert.equal(cards.b4.box,3);assert.equal(p.xp,200);cards.a14.box=1;a.refreshCorrectedContent(p);assert.equal(cards.a14.box,1);
 for(const c of Object.values(cards))c.box=3;for(const q of w.ORT_QUESTIONS.filter(q=>q.t==='signals'))cards[q.id].box=0;assert.ok(a.readiness().m>0.8);assert.equal(a.readiness().topicReady,false);assert.equal(a.readiness().ready,false);assert.ok(a.sourceHTML(w.ORT_QUESTIONS.find(q=>q.id==='b4')).includes('0286-0110'));
});
