interface Env { OPENAI_API_KEY: string }

function extractText(data: any): string {
  if (data.output_text) return data.output_text
  for (const item of data.output || []) for (const c of item.content || []) if (c.type === 'output_text') return c.text
  return ''
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.OPENAI_API_KEY) return Response.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 })
  const { image } = await request.json<any>()
  if (!image) return Response.json({ error: 'Image is required.' }, { status: 400 })

  const body = {
    model: 'gpt-5.6',
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: 'Analyze this source image as an expert cinematic AI-video director. Write one production-ready image-to-video prompt. Preserve subject identity/anatomy and scene continuity. Describe natural motion, camera movement, lens/shot feel, lighting behavior, physics, background motion, and what must remain unchanged. Avoid written text unless already essential to the scene. Return only the prompt.' },
        { type: 'input_image', image_url: image }
      ]
    }]
  }

  const r = await fetch('https://api.openai.com/v1/responses', {
    method:'POST',
    headers:{'authorization':`Bearer ${env.OPENAI_API_KEY}`,'content-type':'application/json'},
    body:JSON.stringify(body)
  })
  const data=await r.json<any>()
  if(!r.ok)return Response.json({error:data?.error?.message||'Image analysis failed.'},{status:r.status})
  return Response.json({prompt:extractText(data)})
}
