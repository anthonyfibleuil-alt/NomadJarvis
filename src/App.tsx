import { useEffect, useState } from 'react'
import {
  Clapperboard, Loader2, MessageSquareText, Plus,
  Sparkles, Upload, WandSparkles, CheckCircle2
} from 'lucide-react'
import { fileToDataUrl, postJSON } from './api'
import { AccountMenu, PrivateChat, accountRequest } from './Accounts'

type Workspace = 'chat' | 'video' | 'motion'

const meta = {
  chat: { title: 'Chat & Research', subtitle: 'Ask anything, search the live web, and work with project context.', icon: MessageSquareText },
  video: { title: 'AI Video Studio', subtitle: 'Analyze a source image, approve the prompt, then generate.', icon: Clapperboard },
  motion: { title: 'Motion Studio', subtitle: 'Turn interview content into useful, restrained motion graphics.', icon: WandSparkles },
} satisfies Record<Workspace, any>

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>('chat')
  const M = meta[workspace]
  const ActiveIcon = M.icon
  return <div className="shell">
    <aside>
      <div className="brand"><div className="logo"><Sparkles size={18}/></div><div><b>NomadJarvis</b><small>AI workspace</small></div></div>
      <button className="new" onClick={()=>{setWorkspace('chat');window.dispatchEvent(new Event('nomad-new-chat'))}}><Plus size={17}/> New conversation</button>
      {(Object.keys(meta) as Workspace[]).map(k => {
        const I = meta[k].icon
        return <button className={`nav ${workspace===k?'active':''}`} onClick={()=>setWorkspace(k)} key={k}><I size={18}/><span>{meta[k].title}</span></button>
      })}
      <div className="spacer"/>
      <AccountMenu />
    </aside>

    <main>
      <header>
        <div><div className="header-title"><ActiveIcon size={21}/><h1>{M.title}</h1></div><p>{M.subtitle}</p></div>
        <div className="online"><span/> Private workspace</div>
      </header>
      {workspace==='chat' && <PrivateChat />}
      {workspace==='video' && <Video />}
      {workspace==='motion' && <Motion />}
    </main>
  </div>
}

function Video(){
  const [preview,setPreview]=useState('')
  const [prompt,setPrompt]=useState('')
  const [busy,setBusy]=useState(false)
  const [approved,setApproved]=useState(false)
  const [status,setStatus]=useState('Choose an image to begin.')
  const [error,setError]=useState('')

  async function choose(f?:File){
    if(!f)return
    setApproved(false); setPrompt(''); setError('')
    const data=await fileToDataUrl(f); setPreview(data)
    setBusy(true); setStatus('Analyzing image and writing cinematic prompt…')
    try{
      const r=await postJSON<{prompt:string}>('/api/video-prompt',{image:data})
      setPrompt(r.prompt); setStatus('Prompt ready — edit it if you want, then approve.')
    }catch(e:any){setError(e.message);setStatus('Could not generate prompt.')}
    finally{setBusy(false)}
  }

  async function generate(){
    setApproved(true); setBusy(true); setError('')
    try{
      const r=await postJSON<{status:string;message:string}>('/api/video-generate',{prompt})
      setStatus(r.message)
    }catch(e:any){setError(e.message)}
    finally{setBusy(false)}
  }

  return <section className="workspace studio">
    <Draft kind="video" state={{prompt}} restore={s=>{if(typeof s.prompt==='string')setPrompt(s.prompt)}}/>
    <div className="panel">
      <Step n="1" title="Source image" sub="Upload a reference image."/>
      <label className="drop">
        {preview?<img src={preview}/>:<><Upload size={28}/><b>Choose an image</b><span>JPG, PNG or WEBP</span></>}
        <input type="file" accept="image/*" onChange={e=>choose(e.target.files?.[0])}/>
      </label>
    </div>
    <div className="panel">
      <Step n="2" title="AI prompt" sub="Jarvis analyzes the source and writes the motion."/>
      {busy&&!prompt?<div className="center"><Loader2 className="spin"/>Analyzing…</div>:
      <textarea className="prompt" value={prompt} onChange={e=>{setPrompt(e.target.value);setApproved(false)}} placeholder="Your generated prompt will appear here."/>}
      <div className="row"><span className="muted">{status}</span><button className="primary" disabled={!prompt||busy} onClick={generate}>{approved?<CheckCircle2 size={16}/>:null} Approve & generate</button></div>
      {error&&<div className="error">{error}</div>}
    </div>
    <div className="panel full">
      <Step n="3" title="Generation output" sub="Video-provider adapter is ready; the final provider endpoint is the next integration."/>
      <div className="empty"><Clapperboard size={30}/><p>{approved?'Prompt approved. Connect Seedance/Kling/Veo provider to render here.':'Approve a prompt first.'}</p></div>
    </div>
  </section>
}

function Motion(){
  const [file,setFile]=useState<File|null>(null)
  const [transcript,setTranscript]=useState('')
  const [plan,setPlan]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')

  async function analyze(){
    if(!transcript.trim())return
    setBusy(true);setError('')
    try{
      const r=await postJSON<{plan:string}>('/api/motion-plan',{transcript})
      setPlan(r.plan)
    }catch(e:any){setError(e.message)}
    finally{setBusy(false)}
  }

  return <section className="workspace studio">
    <Draft kind="motion" state={{transcript,plan}} restore={s=>{if(typeof s.transcript==='string')setTranscript(s.transcript);if(typeof s.plan==='string')setPlan(s.plan)}}/>
    <div className="panel full">
      <Step n="1" title="Interview" sub="Choose your video; paste or add transcript below."/>
      <label className="drop compact">
        <Upload size={24}/><b>{file?file.name:'Choose interview video'}</b><span>{file?`${(file.size/1024/1024).toFixed(1)} MB`:'MP4 / MOV'}</span>
        <input type="file" accept="video/*" onChange={e=>setFile(e.target.files?.[0]||null)}/>
      </label>
      <textarea className="transcript" value={transcript} onChange={e=>setTranscript(e.target.value)} placeholder="Paste transcript here. Automatic file transcription is the next backend step after deployment."/>
      <button className="primary standalone" onClick={analyze} disabled={!transcript.trim()||busy}>{busy?<Loader2 className="spin" size={16}/>:<Sparkles size={16}/>} Build motion plan</button>
      {error&&<div className="error">{error}</div>}
    </div>
    <div className="panel">
      <Step n="2" title="AI suggestions" sub="Use graphics only where they add clarity."/>
      <div className="plan">{plan||'Timestamped suggestions will appear here.'}</div>
    </div>
    <div className="panel">
      <Step n="3" title="Timeline" sub="Approved elements become timeline layers."/>
      <div className="timeline"><i style={{width:'70%'}}/><i style={{width:'38%'}}/><i style={{width:'55%'}}/></div>
    </div>
  </section>
}

function Step({n,title,sub}:{n:string,title:string,sub:string}){
  return <div className="step"><span>{n}</span><div><h3>{title}</h3><p>{sub}</p></div></div>
}

function Draft({kind,state,restore}:{kind:'video'|'motion';state:Record<string,string>;restore:(state:Record<string,string>)=>void}){
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('')
  useEffect(()=>{let active=true;void accountRequest<{state:Record<string,string>|null}>('studio&kind='+kind).then(r=>{if(active&&r.state)restore(r.state)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[kind])
  async function save(){setSaving(true);setError('');setNotice('');try{await accountRequest('studio&kind='+kind,'PUT',state);setNotice('Draft saved to your account.')}catch(e){setError((e as Error).message)}finally{setSaving(false)}}
  return <div className="panel full"><div className="row"><span className="muted">{loading?'Loading your draft…':'Save your text and plans to return to later. Reattach source files when needed.'}</span><button className="primary" disabled={loading||saving} onClick={()=>void save()}>{saving?'Saving…':'Save draft'}</button></div>{notice&&<p role="status">{notice}</p>}{error&&<p className="error" role="alert">{error}</p>}</div>
}
