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
export const DEVICE_LIMIT = 3;
export function deviceLabel(request) {
  const ua = request.headers.get('User-Agent') || '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\/|FxiOS\//.test(ua) ? 'Firefox' : /Chrome\/|CriOS\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const system = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Macintosh|Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'device';
  return `${browser} on ${system}`;
}
export async function getIdentity(request, env) {
  const token = (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName(env) + '='))?.split('=')[1];
  if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
  const tokenHash = await hash(token);
  const identity = await env.DB.prepare('SELECT i.id, i.recovery_hash, d.id AS device_id FROM identities i JOIN sessions s ON s.identity_id=i.id LEFT JOIN devices d ON d.token_hash=s.token_hash WHERE s.token_hash=? AND s.expires_at>?').bind(tokenHash, now()).first();
  if (identity?.device_id) await env.DB.prepare('UPDATE devices SET last_used_at=? WHERE id=?').bind(now(), identity.device_id).run();
  return identity;
}
export async function listDevices(identityId, env, currentId = null) {
  const rows = await env.DB.prepare('SELECT d.id,d.label,d.created_at,d.last_used_at FROM devices d JOIN sessions s ON s.token_hash=d.token_hash WHERE d.identity_id=? AND s.expires_at>? ORDER BY d.created_at,d.id').bind(identityId,now()).all();
  return rows.results.map(d => ({id:d.id,label:d.label,createdAt:d.created_at,lastUsedAt:d.last_used_at,current:d.id===currentId}));
}
export async function createSession(identityId, env, label = 'Browser', replaceDeviceId = null) {
  const token = opaque(), tokenHash = await hash(token), stamp = now();
  const statements = [env.DB.prepare('DELETE FROM sessions WHERE identity_id=? AND expires_at<=?').bind(identityId,stamp)];
  if (replaceDeviceId) statements.push(env.DB.prepare('DELETE FROM sessions WHERE identity_id=? AND token_hash=(SELECT token_hash FROM devices WHERE id=? AND identity_id=?)').bind(identityId,replaceDeviceId,identityId));
  // D1 executes this batch as one transaction. The conditional insert enforces the
  // cap even when two browsers restore simultaneously. No bearer/hash is exposed.
  statements.push(env.DB.prepare('INSERT INTO sessions(token_hash,identity_id,expires_at,created_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM sessions WHERE identity_id=? AND expires_at>?)<?').bind(tokenHash,identityId,stamp+2592000,stamp,identityId,stamp,DEVICE_LIMIT));
  statements.push(env.DB.prepare('INSERT INTO devices(id,identity_id,token_hash,label,created_at,last_used_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sessions WHERE token_hash=?)').bind(crypto.randomUUID(),identityId,tokenHash,label,stamp,stamp,tokenHash));
  await env.DB.batch(statements);
  const inserted = await env.DB.prepare('SELECT token_hash FROM sessions WHERE token_hash=?').bind(tokenHash).first();
  if (!inserted) return null;
  return sessionCookie(env, token);
}
export async function ensureIdentity(request, env) {
  const existing = await getIdentity(request, env);
  if (existing) return { identity: existing, cookie: null };
  const identity = {id: crypto.randomUUID(), recovery_hash: null};
  await env.DB.prepare('INSERT INTO identities(id,created_at) VALUES(?,?)').bind(identity.id, now()).run();
  return { identity, cookie: await createSession(identity.id, env, deviceLabel(request)) };
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
