import {now} from './access.mjs';
export const APP = 'oahu-road-trip';
export function checkoutOptions(env, identityId) {
  const item = {price: env.STRIPE_PRICE_ID, quantity: 1};
  const options = {
    mode: 'payment', line_items: [item], billing_address_collection: 'required',
    client_reference_id: identityId,
    metadata: {app: APP, identity_id: identityId},
    payment_intent_data: {metadata: {app: APP, identity_id: identityId}},
    success_url: env.APP_ORIGIN + '/?purchase=complete', cancel_url: env.APP_ORIGIN + '/?purchase=cancelled',
    integration_identifier: 'oahu_road_trip_' + Array.from(crypto.getRandomValues(new Uint8Array(8)), b => String.fromCharCode(97 + b % 26)).join(''),
  };
  if (env.TAX_MODE === 'manual' && env.STRIPE_TAX_RATE_ID) item.tax_rates = [env.STRIPE_TAX_RATE_ID];
  else if (env.TAX_MODE === 'automatic' && env.TAX_SETUP_VERIFIED === 'true') options.automatic_tax = {enabled: true};
  else if (env.TAX_MODE !== 'none') throw new Error('tax_not_configured');
  return options;
}
export function checkoutReady(env) {
  return !!env.STRIPE_API_KEY && !!env.STRIPE_PRICE_ID && !!env.STRIPE_WEBHOOK_SECRET &&
    ((env.TAX_MODE === 'manual' && !!env.STRIPE_TAX_RATE_ID) || (env.TAX_MODE === 'automatic' && env.TAX_SETUP_VERIFIED === 'true') || env.TAX_MODE === 'none');
}
export async function fulfill(sessionId, env, stripe) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {expand: ['line_items', 'payment_intent.latest_charge']});
  if (session.metadata?.app !== APP) return;
  const live = env.STRIPE_MODE === 'live';
  if (session.livemode !== live || session.mode !== 'payment' || session.payment_status !== 'paid') return;
  const lines = session.line_items?.data || [];
  const line = lines[0];
  if (lines.length !== 1 || session.line_items.has_more || line.quantity !== 1 || line.price?.id !== env.STRIPE_PRICE_ID || line.price?.unit_amount !== 999 || line.price?.currency !== 'usd' || line.price?.tax_behavior !== 'exclusive' || session.currency !== 'usd' || session.amount_subtotal !== 999 || session.amount_total < 999 || (env.TAX_MODE === 'none' && session.amount_total !== 999)) throw new Error('invalid_order');
  const pending = await env.DB.prepare('SELECT identity_id FROM checkout_attempts WHERE id=?').bind(session.id).first();
  if (!pending || pending.identity_id !== session.client_reference_id || pending.identity_id !== session.metadata.identity_id) throw new Error('unbound_order');
  const pi = session.payment_intent;
  if (!pi?.id || pi.metadata?.app !== APP || pi.metadata?.identity_id !== pending.identity_id || pi.status !== 'succeeded') throw new Error('invalid_payment');
  const blocked = pi.latest_charge && typeof pi.latest_charge === 'object' && (pi.latest_charge.refunded || pi.latest_charge.disputed);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO orders(session_id,identity_id,payment_intent,amount_total,created_at) VALUES(?,?,?,?,?) ON CONFLICT(session_id) DO NOTHING').bind(session.id,pending.identity_id,pi.id,session.amount_total,now()),
    env.DB.prepare("INSERT INTO grants(source_id,identity_id,kind,status,created_at) VALUES(?,?,'paid',CASE WHEN ? OR EXISTS(SELECT 1 FROM payment_blocks WHERE payment_intent=?) THEN 'revoked' ELSE 'active' END,?) ON CONFLICT(source_id) DO UPDATE SET status=CASE WHEN ? OR EXISTS(SELECT 1 FROM payment_blocks WHERE payment_intent=?) THEN 'revoked' ELSE grants.status END").bind(pi.id,pending.identity_id,blocked ? 1 : 0,pi.id,now(),blocked ? 1 : 0,pi.id)
  ]);
}
export async function handlePaymentEvent(event, env, stripe) {
  if (event.livemode !== (env.STRIPE_MODE === 'live')) throw new Error('wrong_environment');
  if (['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) return fulfill(event.data.object.id,env,stripe);
  if (!['charge.refunded','charge.dispute.created'].includes(event.type)) return;
  const object = event.data.object;
  const charge = event.type === 'charge.dispute.created' ? await stripe.charges.retrieve(object.charge) : await stripe.charges.retrieve(object.id);
  if (!charge.payment_intent) return;
  const pi = await stripe.paymentIntents.retrieve(typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent.id);
  if (pi.metadata?.app !== APP || pi.livemode !== (env.STRIPE_MODE === 'live')) return;
  if (event.type === 'charge.refunded' && !charge.refunded) return; // Partial refunds do not automatically cancel the pass.
  const state = event.type === 'charge.dispute.created' ? 'disputed' : 'revoked';
  await env.DB.batch([
    env.DB.prepare('INSERT INTO payment_blocks(payment_intent,status,updated_at) VALUES(?,?,?) ON CONFLICT(payment_intent) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at').bind(pi.id,state,now()),
    env.DB.prepare('UPDATE grants SET status=? WHERE source_id=? AND kind=\'paid\'').bind(state,pi.id)
  ]);
}
