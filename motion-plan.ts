interface Env { OPENAI_API_KEY: string }

function extractText(data:any){
  if(data.output_text)return data.output_text
  for(const o of data.output||[])for(const c of o.content||[])if(c.type==='output_text')return c.text
  return ''
}

export const onRequestPost: PagesFunction<Env> = async ({request,env})=>{
  if(!env.OPENAI_API_KEY)return Response.json({error:'OPENAI_API_KEY is not configured.'},{status:500})
  const {transcript}=await request.json<any>()
  if(!transcript)return Response.json({error:'Transcript is required.'},{status:400})

  const input=`Create a restrained motion-design plan for this interview transcript.

Rules:
- Do NOT decorate every sentence.
- Add graphics only where they improve comprehension, retention, proof, structure, data, names, locations, process, or comparison.
- If a section works better with the speaker alone, explicitly say "No graphic".
- If timestamps exist, preserve them. If not, organize by transcript order.
- For each recommended graphic give: moment, purpose, exact on-screen content, visual treatment, entrance, duration, exit.
- Keep it premium and editorial, not template-like.

TRANSCRIPT:
${transcript}`

  const r=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{'authorization':`Bearer ${env.OPENAI_API_KEY}`,'content-type':'application/json'},
    body:JSON.stringify({model:'gpt-5.6',input})
  })
  const data=await r.json<any>()
  if(!r.ok)return Response.json({error:data?.error?.message||'Motion planning failed.'},{status:r.status})
  return Response.json({plan:extractText(data)})
}