const encoder = new TextEncoder();
export const now = () => Math.floor(Date.now() / 1000);
export const opaque = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('');
export async function hash(value) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), x => x.toString(16).padStart(2, '0')).join(''); }
export function recoveryCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  // Rejection sampling avoids modulo bias. No ambiguous I, O, 0, 1.
  let result = '';
  while (result.length < 40) for (const byte of crypto.getRandomValues(new Uint8Array(64))) {
    if (byte < 256 - (256 % chars.length)) result += chars[byte % chars.length];
    if (result.length === 40) break;
  }
  return 'OAHU-' + result.match(/.{1,5}/g).join('-');
}
export function normalizeCode(code) {
  const cleaned = String(code || '').trim().toUpperCase().replace(/[\s-]/g, '');
  if (!/^OAHU[2-9A-HJ-NP-Z]{40}$/.test(cleaned)) return null;
  return cleaned;
}
export function cookieName(env) { return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(env.APP_ORIGIN || '') ? 'ort_dev_session' : '__Host-ort_session'; }
export function sessionCookie(env, token, maxAge = 2592000) {
  return `${cookieName(env)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${cookieName(env).startsWith('__Host-') ? '; Secure' : ''}`;
}
export async function getIdentity(request, env) {
  const token = (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName(env) + '='))?.split('=')[1];
  if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
  return env.DB.prepare('SELECT i.id, i.recovery_hash FROM identities i JOIN sessions s ON s.identity_id=i.id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash(token), now()).first();
}
export async function createSession(identityId, env) {
  const token = opaque();
  await env.DB.prepare('INSERT INTO sessions(token_hash,identity_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await hash(token), identityId, now() + 2592000, now()).run();
  return sessionCookie(env, token);
}
export async function ensureIdentity(request, env) {
  const existing = await getIdentity(request, env);
  if (existing) return { identity: existing, cookie: null };
  const identity = {id: crypto.randomUUID(), recovery_hash: null};
  await env.DB.prepare('INSERT INTO identities(id,created_at) VALUES(?,?)').bind(identity.id, now()).run();
  return { identity, cookie: await createSession(identity.id, env) };
}
export async function entitlement(identity, env) {
  if (!identity) return {active: false, owner: false};
  const row = await env.DB.prepare("SELECT COUNT(*) AS n, MAX(CASE WHEN kind='owner' THEN 1 ELSE 0 END) AS owner FROM grants WHERE identity_id=? AND status='active'").bind(identity.id).first();
  return {active: row.n > 0, owner: row.owner === 1};
}
export async function rateLimit(request, env, bucket, maximum, seconds) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const key = await hash(`${env.RATE_LIMIT_SALT}:${bucket}:${ip}:${Math.floor(now() / seconds)}`);
  const row = await env.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key, now() + seconds).first();
  // Expired entries contain hashes, not raw IP addresses, and are pruned opportunistically.
  await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now() - 86400).run();
  return row.count <= maximum;
}
export function sameOrigin(request, env) { return request.headers.get('Origin') === env.APP_ORIGIN && new URL(request.url).origin === env.APP_ORIGIN; }
export function json(data, status = 200, headers = {}) { return new Response(JSON.stringify(data), {status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff', ...headers}}); }
export async function smallJSON(request) {
  const body = await request.text();
  if (body.length > 8192) throw new Error('body_limit');
  return JSON.parse(body);
}
