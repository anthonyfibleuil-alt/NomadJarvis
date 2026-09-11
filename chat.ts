interface Env { OPENAI_API_KEY: string }

function extractText(data: any): string {
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text
  const parts: string[] = []
  for (const item of data.output || []) {
    for (const c of item.content || []) if (c.type === 'output_text' && c.text) parts.push(c.text)
  }
  return parts.join('\n').trim()
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.OPENAI_API_KEY) return Response.json({ error: 'OPENAI_API_KEY is not configured in Cloudflare yet.' }, { status: 500 })
  const { message, useWeb = true } = await request.json<any>()
  if (!message) return Response.json({ error: 'Message is required.' }, { status: 400 })

  const payload: any = {
    model: 'gpt-5.6',
    input: message,
    instructions: 'You are NomadJarvis, a concise, capable personal AI workspace assistant. Answer directly. When web search is used, ground claims in the returned information.',
  }
  if (useWeb) payload.tools = [{ type: 'web_search' }]

  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await r.json<any>()
  if (!r.ok) return Response.json({ error: data?.error?.message || 'OpenAI request failed.' }, { status: r.status })
  return Response.json({ answer: extractText(data) || 'No text response returned.' })
}