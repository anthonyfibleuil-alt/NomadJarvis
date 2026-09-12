import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

export interface AccountEnv {
  DB: D1Database
  GOOGLE_CLIENT_ID: string
  OWNER_EMAIL: string
  APP_ORIGIN: string
  OPENAI_API_KEY?: string
}
export type User = { id: string; email: string; name: string; role: 'owner' | 'member' }
export class HttpError extends Error { constructor(public status: number, message: string) { super(message) } }
const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const sessionCookie = '__Host-nomad_session'
const nonceCookie = '__Host-nomad_nonce'
export const now = () => Math.floor(Date.now() / 1000)
export const normalizeEmail = (email: string) => email.trim().toLowerCase()
export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  const h = new Headers(headers); h.set('Cache-Control', 'no-store'); h.set('X-Content-Type-Options', 'nosniff')
  return Response.json(data, { status, headers: h })
}
export const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('')
export async function hash(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2, '0')).join('') }
function cookie(request: Request, name: string) { return (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.slice(name.length + 1) || '' }
function setCookie(name: string, value: string, age: number) { return `${name}=${value}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax` }
export function checkOrigin(request: Request, env: AccountEnv) {
  if (!env.APP_ORIGIN || new URL(request.url).origin !== env.APP_ORIGIN || request.headers.get('origin') !== env.APP_ORIGIN || request.headers.get('x-nomadjarvis') !== '1') throw new HttpError(403, 'Please reload NomadJarvis and try again.')
}
export async function body(request: Request, max = 32768): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'JSON is required.')
  const reader = request.body?.getReader(); if (!reader) throw new HttpError(400, 'Request body is required.')
  const chunks: Uint8Array[] = []; let size = 0
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > max) { await reader.cancel(); throw new HttpError(413, 'This request is too large.') } chunks.push(value) }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { const data: unknown = JSON.parse(new TextDecoder().decode(bytes)); if (!data || typeof data !== 'object' || Array.isArray(data)) throw 0; return data as Record<string, unknown> } catch { throw new HttpError(400, 'Invalid request body.') }
}
export function textField(data: Record<string, unknown>, key: string, max: number) { const value = data[key]; if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(400, `Invalid ${key}.`); return value.trim() }
export async function rateLimit(env: AccountEnv, key: string, limit: number, seconds: number) {
  const start = Math.floor(now() / seconds) * seconds
  const row = await env.DB.prepare('INSERT INTO usage_windows (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(`${key}:${start}`, start + seconds).first<{count:number}>()
  if (!row || row.count > limit) throw new HttpError(429, 'Too many requests. Please try again shortly.')
}
export async function getUser(request: Request, env: AccountEnv): Promise<User | null> {
  if (!env.DB || !env.OWNER_EMAIL) return null
  const token = cookie(request, sessionCookie); if (!/^[a-f0-9]{64}$/.test(token)) return null
  const row = await env.DB.prepare('SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND (u.email=? OR EXISTS(SELECT 1 FROM allowed_accounts a WHERE a.email=u.email))').bind(await hash(token), now(), normalizeEmail(env.OWNER_EMAIL)).first<{id:string;email:string;name:string}>()
  return row ? { ...row, role: row.email === normalizeEmail(env.OWNER_EMAIL) ? 'owner' : 'member' } : null
}
export async function requireUser(request: Request, env: AccountEnv) { const user = await getUser(request, env); if (!user) throw new HttpError(401, 'Please sign in to continue.'); return user }
export async function verifyGoogle(token: string, clientId: string, nonce: string, verifier: JWTVerifyGetKey = keys) {
  const { payload } = await jwtVerify(token, verifier, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: clientId, algorithms: ['RS256'], requiredClaims: ['sub','exp','iat','nonce','email','email_verified'], maxTokenAge: '10m' })
  if (payload.nonce !== nonce || payload.email_verified !== true || typeof payload.email !== 'string' || !payload.sub) throw new HttpError(401, 'Google sign-in could not be verified.')
  const email = normalizeEmail(payload.email)
  if (!email.endsWith('@gmail.com') && typeof payload.hd !== 'string') throw new HttpError(403, 'Please use a Gmail or Google Workspace account.')
  return { id: payload.sub, email, name: typeof payload.name === 'string' ? payload.name.slice(0,100) : email }
}
export async function account(request: Request, env: AccountEnv, verifier: JWTVerifyGetKey = keys) {
  const url = new URL(request.url); const resource = url.searchParams.get('resource') || 'session'; const method = request.method
  if (method !== 'GET') checkOrigin(request, env)
  if (resource === 'session' && method === 'GET') return json({ user: await getUser(request, env), configured: Boolean(env.DB && env.GOOGLE_CLIENT_ID && env.OWNER_EMAIL && env.APP_ORIGIN), clientId: env.GOOGLE_CLIENT_ID || '' })
  if (!env.DB || !env.GOOGLE_CLIENT_ID || !env.OWNER_EMAIL || !env.APP_ORIGIN) throw new HttpError(503, 'Sign-in setup is not finished. Please contact the owner.')
  if (resource === 'nonce' && method === 'POST') {
    await rateLimit(env, 'login:' + (request.headers.get('cf-connecting-ip') || 'unknown'), 30, 600)
    const nonce = randomToken()
    await env.DB.batch([env.DB.prepare('DELETE FROM login_nonces WHERE expires_at<?').bind(now()), env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now()), env.DB.prepare('DELETE FROM usage_windows WHERE expires_at<?').bind(now()), env.DB.prepare('INSERT INTO login_nonces VALUES (?,?)').bind(await hash(nonce),now()+600)])
    return json({nonce},200,{'Set-Cookie':setCookie(nonceCookie,nonce,600)})
  }
  if (resource === 'google' && method === 'POST') {
    await rateLimit(env, 'verify:' + (request.headers.get('cf-connecting-ip') || 'unknown'), 30, 600)
    const data = await body(request); const token = textField(data,'credential',16000); const nonce = cookie(request,nonceCookie)
    if (!/^[a-f0-9]{64}$/.test(nonce)) throw new HttpError(401,'Sign-in expired. Please reload and try again.')
    const used = await env.DB.prepare('DELETE FROM login_nonces WHERE nonce_hash=? AND expires_at>? RETURNING nonce_hash').bind(await hash(nonce),now()).first()
    if (!used) throw new HttpError(401,'Sign-in expired. Please reload and try again.')
    let identity: Awaited<ReturnType<typeof verifyGoogle>>
    try { identity = await verifyGoogle(token,env.GOOGLE_CLIENT_ID,nonce,verifier) } catch(error) { if (error instanceof HttpError) throw error; throw new HttpError(401,'Google sign-in could not be verified. Please reload and try again.') }
    const isOwner = identity.email === normalizeEmail(env.OWNER_EMAIL)
    if (!isOwner && !await env.DB.prepare('SELECT email FROM allowed_accounts WHERE email=?').bind(identity.email).first()) throw new HttpError(403,'This account has not been invited. Ask the owner to add your Google email.')
    const session = randomToken(); const previous = cookie(request,sessionCookie)
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name').bind(identity.id,identity.email,identity.name,now()),
      env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(previous)),
      env.DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(session),identity.id,now()+604800)
    ])
    const h = new Headers(); h.append('Set-Cookie',setCookie(sessionCookie,session,604800)); h.append('Set-Cookie',setCookie(nonceCookie,'',0))
    return json({user:{...identity,role:isOwner?'owner':'member'}},200,h)
  }
  if (resource === 'logout' && method === 'POST') { await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(cookie(request,sessionCookie))).run(); return json({ok:true},200,{'Set-Cookie':setCookie(sessionCookie,'',0)}) }
  const user = await requireUser(request,env)
  if (method !== 'GET') await rateLimit(env,'account:'+user.id,120,60)
  if (resource === 'invites') {
    if (user.role !== 'owner') throw new HttpError(403,'Only the owner can manage access.')
    if (method === 'GET') return json({invites:(await env.DB.prepare('SELECT a.email,a.added_at,u.name FROM allowed_accounts a LEFT JOIN users u ON u.email=a.email ORDER BY a.added_at DESC').all()).results})
    const data = await body(request); const email = normalizeEmail(textField(data,'email',254))
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === normalizeEmail(env.OWNER_EMAIL)) throw new HttpError(400,'Enter a member’s Google email. The owner always has access.')
    if (method === 'POST') { await env.DB.prepare('INSERT INTO allowed_accounts VALUES(?,?,?) ON CONFLICT(email) DO NOTHING').bind(email,now(),user.id).run(); return json({ok:true}) }
    if (method === 'DELETE') { await env.DB.batch([env.DB.prepare('DELETE FROM allowed_accounts WHERE email=?').bind(email),env.DB.prepare('DELETE FROM sessions WHERE user_id IN(SELECT id FROM users WHERE email=?)').bind(email)]); return json({ok:true}) }
  }
  if (resource === 'memories') {
    if (method === 'GET') return json({memories:(await env.DB.prepare('SELECT id,content,updated_at FROM memories WHERE user_id=? ORDER BY updated_at DESC').bind(user.id).all()).results})
    const data = await body(request)
    if (method === 'POST') {
      const content = textField(data,'content',2000); const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM memories WHERE user_id=?').bind(user.id).first<{n:number}>()
      if (count && count.n >= 100) throw new HttpError(400,'You can save up to 100 memories. Remove one before adding more.')
      const id = crypto.randomUUID(); await env.DB.prepare('INSERT INTO memories VALUES(?,?,?,?)').bind(id,user.id,content,now()).run(); return json({id})
    }
    const id = textField(data,'id',100)
    if (method === 'PUT') { const result=await env.DB.prepare('UPDATE memories SET content=?,updated_at=? WHERE id=? AND user_id=?').bind(textField(data,'content',2000),now(),id,user.id).run(); if(!result.meta.changes) throw new HttpError(404,'Memory not found.'); return json({ok:true}) }
    if (method === 'DELETE') { await env.DB.prepare('DELETE FROM memories WHERE id=? AND user_id=?').bind(id,user.id).run(); return json({ok:true}) }
  }
  if (resource === 'conversations') {
    const id = url.searchParams.get('id')
    if (method === 'GET' && !id) return json({conversations:(await env.DB.prepare('SELECT id,title,updated_at FROM conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 100').bind(user.id).all()).results})
    if (method === 'GET' && id) {
      if (!await env.DB.prepare('SELECT id FROM conversations WHERE id=? AND user_id=?').bind(id,user.id).first()) throw new HttpError(404,'Conversation not found.')
      return json({messages:(await env.DB.prepare('SELECT id,role,content FROM messages WHERE conversation_id=? AND user_id=? ORDER BY created_at,id LIMIT 200').bind(id,user.id).all()).results})
    }
    if (method === 'DELETE') { const data=await body(request); const key=textField(data,'id',100); await env.DB.batch([env.DB.prepare('DELETE FROM messages WHERE conversation_id=? AND user_id=?').bind(key,user.id),env.DB.prepare('DELETE FROM conversations WHERE id=? AND user_id=?').bind(key,user.id)]); return json({ok:true}) }
  }
  if (resource === 'studio') {
    const kind=url.searchParams.get('kind'); if(kind!=='video' && kind!=='motion') throw new HttpError(400,'Invalid workspace.')
    if(method==='GET') { const row=await env.DB.prepare('SELECT content FROM studio_state WHERE user_id=? AND kind=?').bind(user.id,kind).first<{content:string}>(); return json({state:row?JSON.parse(row.content):null}) }
    if(method==='PUT') { const data=await body(request,65536); await env.DB.prepare('INSERT INTO studio_state VALUES(?,?,?,?) ON CONFLICT(user_id,kind) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at').bind(user.id,kind,JSON.stringify(data),now()).run(); return json({ok:true}) }
  }
  throw new HttpError(405,'This action is not supported.')
}
export const onRequest: PagesFunction<AccountEnv> = async ({request,env}) => {
  try { return await account(request,env) } catch(error) { return json({error:error instanceof HttpError?error.message:'Something went wrong. Please try again.'},error instanceof HttpError?error.status:500) }
}
