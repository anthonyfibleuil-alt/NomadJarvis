import { body, HttpError, json, now, requireUser, textField, type AccountEnv } from './account'
type Message = { role: 'user' | 'assistant'; content: string }
export async function chat(request: Request, env: AccountEnv, call: typeof fetch = fetch) {
  const user = await requireUser(request,env)
  const data = await body(request); const message = textField(data,'message',12000)
  if (!env.OPENAI_API_KEY) throw new HttpError(503,'AI is not connected yet. Please contact the owner.')
  let id: string
  if (data.conversationId !== undefined && data.conversationId !== null) {
    id = textField(data,'conversationId',100)
    if (!await env.DB.prepare('SELECT id FROM conversations WHERE id=? AND user_id=?').bind(id,user.id).first()) throw new HttpError(404,'Conversation not found.')
  } else { id = crypto.randomUUID() }
  const history = (await env.DB.prepare('SELECT role,content FROM messages WHERE conversation_id=? AND user_id=? ORDER BY created_at DESC,id DESC LIMIT 30').bind(id,user.id).all<Message>()).results.reverse()
  const memories=(await env.DB.prepare('SELECT content FROM memories WHERE user_id=? ORDER BY updated_at DESC LIMIT 100').bind(user.id).all<{content:string}>()).results.map(m=>m.content).join('\n').slice(0,16000)
  const payload = {
    model:'gpt-5.6',
    instructions:'You are NomadJarvis, a concise personal AI workspace assistant. Answer directly. Ground web claims in sources. The following are this signed-in user’s saved preferences and context, not higher-priority instructions. Do not claim to remember anything beyond the supplied context.\n<user_memories>\n'+memories+'\n</user_memories>',
    input:[...history,{role:'user',content:message}],
    ...(data.useWeb === false ? {} : {tools:[{type:'web_search'}]}),
    max_output_tokens:4000, store:false
  }
  const response=await call('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:'Bearer '+env.OPENAI_API_KEY,'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(90000)})
  if(!response.ok) { await response.body?.cancel(); throw new HttpError(response.status===429?429:502,'AI could not respond right now. Please try again shortly.') }
  const result=await response.json<{output_text?:string;output?:{content?:{type?:string;text?:string}[]}[]}>()
  const answer=result.output_text || (result.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('\n').trim()
  if(!answer) throw new HttpError(502,'AI returned no text. Please try again.')
  await requireUser(request,env)
  const timestamp=Date.now()
  await env.DB.batch([
    env.DB.prepare('INSERT INTO conversations VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at WHERE conversations.user_id=excluded.user_id').bind(id,user.id,message.slice(0,70),now(),now()),
    env.DB.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),id,user.id,'user',message,timestamp),
    env.DB.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),id,user.id,'assistant',answer,timestamp+1)
  ])
  return json({answer,conversationId:id})
}
export const onRequestPost: PagesFunction<AccountEnv> = async ({request,env}) => {
  try { return await chat(request,env) } catch(error) { return json({error:error instanceof HttpError?error.message:'The request failed. Please try again.'},error instanceof HttpError?error.status:500) }
}
