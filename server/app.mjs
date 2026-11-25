import {now, opaque, hash, recoveryCode, normalizeCode, cookieName, sessionCookie, getIdentity, createSession, ensureIdentity, entitlement, rateLimit, sameOrigin, json, smallJSON} from './access.mjs';
import {checkoutOptions, checkoutReady, handlePaymentEvent} from './payments.mjs';
const FREE_TOPIC = 'basics';
const ALLOWED_ASSET = /^(?:\/|\/index\.html|\/css\/style\.css|\/js\/(?:game|signs)\.js|\/signs\/[A-Za-z0-9_-]+\.svg|\/assets\/oahu-arcade-hero-v2\.svg|\/favicon\.ico|\/robots\.txt)$/;
export function createApp({questions, makeStripe, verifyEvent}) {
  const topicQuestionIds = {};
  for (const question of questions) (topicQuestionIds[question.t] ||= []).push(question.id);
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const path = url.pathname;
      if (!path.startsWith('/api/')) {
        if (!['GET','HEAD'].includes(request.method) || !ALLOWED_ASSET.test(path)) return new Response('Not found', {status:404});
        const response = await env.ASSETS.fetch(request);
        const headers = new Headers(response.headers);
        headers.set('X-Content-Type-Options','nosniff'); headers.set('Referrer-Policy','same-origin');
        headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
        if (path === '/' || path === '/index.html') headers.set('Cache-Control','no-cache');
        return new Response(response.body,{status:response.status,headers});
      }
      if (path === '/api/bootstrap' && request.method === 'GET' && (!env.DB || !env.APP_ORIGIN || !env.RATE_LIMIT_SALT)) return json({questions:questions.filter(q => q.t === FREE_TOPIC),topicQuestionIds,totalQuestions:questions.length,pass:{active:false,owner:false,hasRecoveryCode:false},checkoutAvailable:false,testMode:true,price:999,currency:'usd'});
      if (!env.DB || !env.APP_ORIGIN || !env.RATE_LIMIT_SALT || !['test','live'].includes(env.STRIPE_MODE)) return json({error:'Full Island Pass setup is not complete. Please try again later.'},503);
      if (new URL(env.APP_ORIGIN).origin !== url.origin) return json({error:'This environment is not configured for this address.'},503);
      if (request.method === 'POST' && path !== '/api/stripe/webhook' && !sameOrigin(request,env)) return json({error:'Please return to the app and try again.'},403);
      try {
        if (path === '/api/bootstrap' && request.method === 'GET') {
          const identity = await getIdentity(request,env);
          const access = await entitlement(identity,env);
          return json({questions:questions.filter(q => access.active || q.t === FREE_TOPIC),topicQuestionIds,totalQuestions:questions.length,pass:{...access,hasRecoveryCode:!!identity?.recovery_hash},checkoutAvailable:checkoutReady(env),testMode:env.STRIPE_MODE !== 'live',price:999,currency:'usd'});
        }
        if (path === '/api/checkout' && request.method === 'POST') {
          if (!checkoutReady(env)) return json({error:'Checkout is not available yet. Your free level is still available.'},503);
          if (!await rateLimit(request,env,'checkout',10,600)) return json({error:'Please wait a few minutes before trying checkout again.'},429);
          const {identity,cookie} = await ensureIdentity(request,env);
          if ((await entitlement(identity,env)).active) return json({alreadyUnlocked:true},200,cookie ? {'Set-Cookie':cookie} : {});
          const stripe = makeStripe(env);
          const price = await stripe.prices.retrieve(env.STRIPE_PRICE_ID);
          if (!price.active || price.type !== 'one_time' || price.unit_amount !== 999 || price.currency !== 'usd' || price.tax_behavior !== 'exclusive' || price.livemode !== (env.STRIPE_MODE === 'live')) throw new Error('price_configuration');
          const checkout = await stripe.checkout.sessions.create(checkoutOptions(env,identity.id),{idempotencyKey:`oahu:${identity.id}:${opaque()}`});
          await env.DB.prepare('INSERT INTO checkout_attempts(id,identity_id,created_at) VALUES(?,?,?)').bind(checkout.id,identity.id,now()).run();
          if (!checkout.url?.startsWith('https://checkout.stripe.com/')) throw new Error('checkout_url');
          return json({url:checkout.url},200,cookie ? {'Set-Cookie':cookie} : {});
        }
        if (path === '/api/recovery/issue' && request.method === 'POST') {
          const identity = await getIdentity(request,env);
          if (!(await entitlement(identity,env)).active) return json({error:'A Full Island Pass is required.'},403);
          if (!await rateLimit(request,env,'issue',5,600)) return json({error:'Please wait before generating another code.'},429);
          const code = recoveryCode();
          await env.DB.prepare('UPDATE identities SET recovery_hash=? WHERE id=?').bind(await hash(normalizeCode(code)),identity.id).run();
          return json({code,notice:'Keep this private. Generating a new code replaces your previous recovery code.'});
        }
        if (path === '/api/recovery/restore' && request.method === 'POST') {
          if (!await rateLimit(request,env,'restore',10,600)) return json({error:'Too many attempts. Please wait ten minutes.'},429);
          const body = await smallJSON(request);
          const normalized = normalizeCode(body.code);
          if (!normalized) return json({error:'That code was not recognized. Check your saved Full Island Pass code.'},400);
          const identity = await env.DB.prepare('SELECT id,recovery_hash FROM identities WHERE recovery_hash=?').bind(await hash(normalized)).first();
          if (!(await entitlement(identity,env)).active) return json({error:'That code was not recognized or its pass is no longer active.'},400);
          return json({restored:true},200,{'Set-Cookie':await createSession(identity.id,env)});
        }
        if (path === '/api/logout' && request.method === 'POST') {
          const raw = (request.headers.get('Cookie') || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName(env)+'='))?.split('=')[1];
          if (/^[a-f0-9]{64}$/.test(raw || '')) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(raw)).run();
          return json({signedOut:true},200,{'Set-Cookie':sessionCookie(env,'',0)});
        }
        if (path === '/api/stripe/webhook' && request.method === 'POST') {
          if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_API_KEY) return json({error:'Webhook is not configured.'},503);
          const body = await request.text();
          if (body.length > 262144) return json({error:'Request too large.'},413);
          let event;
          try { event = await verifyEvent(body,request.headers.get('Stripe-Signature'),env); }
          catch { return json({error:'Invalid webhook signature.'},400); }
          await handlePaymentEvent(event,env,makeStripe(env));
          return json({received:true});
        }
        return json({error:'Not found'},404);
      } catch {
        // Do not expose provider errors, credentials, recovery codes, or request bodies.
        return json({error:'The request could not be completed. Please try again.'},500);
      }
    }
  };
}
