import { useMemo, useState } from 'react'
import {
  Bot,
  Clapperboard,
  FolderOpen,
  MessageSquareText,
  Plus,
  Search,
  Settings,
  Sparkles,
  Upload,
  WandSparkles,
} from 'lucide-react'

type Workspace = 'chat' | 'video' | 'motion'

const workspaceMeta = {
  chat: {
    title: 'Chat & Research',
    subtitle: 'Ask, search the web, upload files, and work with your Drive.',
    icon: MessageSquareText,
  },
  video: {
    title: 'AI Video Studio',
    subtitle: 'Turn an image into an approved generation prompt, then create video.',
    icon: Clapperboard,
  },
  motion: {
    title: 'Motion Studio',
    subtitle: 'Analyze interviews, propose useful graphics, and build an edit timeline.',
    icon: WandSparkles,
  },
} satisfies Record<Workspace, { title: string; subtitle: string; icon: typeof Bot }>

function App() {
  const [workspace, setWorkspace] = useState<Workspace>('chat')
  const meta = workspaceMeta[workspace]
  const ActiveIcon = meta.icon

  const content = useMemo(() => {
    if (workspace === 'chat') return <ChatWorkspace />
    if (workspace === 'video') return <VideoWorkspace />
    return <MotionWorkspace />
  }, [workspace])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={18} /></div>
          <div>
            <strong>NomadJarvis</strong>
            <span>AI workspace</span>
          </div>
        </div>

        <button className="new-project"><Plus size={18}/> New project</button>

        <nav>
          {(Object.keys(workspaceMeta) as Workspace[]).map((key) => {
            const item = workspaceMeta[key]
            const Icon = item.icon
            return (
              <button
                key={key}
                className={workspace === key ? 'nav-item active' : 'nav-item'}
                onClick={() => setWorkspace(key)}
              >
                <Icon size={18}/>
                {item.title}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-section">
          <span className="eyebrow">PROJECTS</span>
          <button className="nav-item muted"><FolderOpen size={18}/> Recent projects</button>
        </div>

        <div className="sidebar-bottom">
          <button className="nav-item muted"><Settings size={18}/> Settings</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="title-row">
              <ActiveIcon size={22}/>
              <h1>{meta.title}</h1>
            </div>
            <p>{meta.subtitle}</p>
          </div>
          <button className="ghost-button"><Search size={17}/> Search projects</button>
        </header>

        {content}
      </main>
    </div>
  )
}

function ChatWorkspace() {
  return (
    <section className="workspace chat-layout">
      <div className="hero-card">
        <div className="orb"><Bot size={32}/></div>
        <h2>What are we working on?</h2>
        <p>Research the web, analyze a file, or continue a project.</p>
        <div className="composer">
          <textarea placeholder="Ask NomadJarvis anything…" />
          <div className="composer-actions">
            <div>
              <button className="icon-button"><Upload size={17}/> Upload</button>
              <button className="icon-button"><FolderOpen size={17}/> Drive</button>
            </div>
            <button className="send-button">Send</button>
          </div>
        </div>
      </div>
      <div className="quick-grid">
        <QuickCard title="Research" text="Browse the web and synthesize sources into an answer." />
        <QuickCard title="Work with files" text="Upload documents, images, spreadsheets, or briefs." />
        <QuickCard title="Continue a project" text="Keep chat, files, video and motion work together." />
      </div>
    </section>
  )
}

function VideoWorkspace() {
  return (
    <section className="workspace studio-grid">
      <div className="panel">
        <div className="panel-heading">
          <span>1</span>
          <div><h3>Choose source</h3><p>Upload an image or select it from Drive.</p></div>
        </div>
        <div className="dropzone">
          <Upload size={26}/>
          <strong>Drop an image here</strong>
          <span>or connect Google Drive</span>
          <button className="secondary-button">Choose image</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <span>2</span>
          <div><h3>AI prompt</h3><p>Jarvis analyzes the image and proposes the motion.</p></div>
        </div>
        <textarea
          className="prompt-box"
          defaultValue="Once an image is selected, an editable cinematic video prompt will appear here."
        />
        <div className="approval-row">
          <span className="status-dot"/> Waiting for source
          <button className="primary-button" disabled>Approve & generate</button>
        </div>
      </div>

      <div className="panel wide">
        <div className="panel-heading">
          <span>3</span>
          <div><h3>Generation</h3><p>Provider-ready architecture for Seedance and other video models.</p></div>
        </div>
        <div className="empty-output">
          <Clapperboard size={30}/>
          <p>Your generated clip will appear here.</p>
        </div>
      </div>
    </section>
  )
}

function MotionWorkspace() {
  return (
    <section className="workspace studio-grid">
      <div className="panel wide">
        <div className="panel-heading">
          <span>1</span>
          <div><h3>Interview video</h3><p>Upload a clip. Jarvis will transcribe and understand the content.</p></div>
        </div>
        <div className="dropzone compact">
          <Upload size={24}/>
          <strong>Upload interview video</strong>
          <span>MP4, MOV or a Drive file</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <span>2</span>
          <div><h3>Graphic suggestions</h3><p>Only add motion graphics where they improve understanding.</p></div>
        </div>
        <div className="suggestion-placeholder">
          <Sparkles size={22}/>
          <p>Timestamped infographic suggestions will appear here for approval.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <span>3</span>
          <div><h3>Timeline</h3><p>Approved elements become editable timeline layers.</p></div>
        </div>
        <div className="timeline">
          <div className="track"><span style={{width:'68%'}}/></div>
          <div className="track"><span style={{width:'35%'}}/></div>
          <div className="track"><span style={{width:'52%'}}/></div>
        </div>
      </div>
    </section>
  )
}

function QuickCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="quick-card">
      <Sparkles size={18}/>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

export default App
