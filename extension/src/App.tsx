import { useEffect, useRef, useState } from 'react'
import { Link2, ShieldCheck, X } from 'lucide-react'
import { BrandMark } from './components/BrandMark'
import { Tabs } from './components/Tabs'
import type { TabId } from './components/Tabs'
import { LiveView } from './views/LiveView'
import { ResearchView } from './views/ResearchView'
import { SettingsView } from './views/SettingsView'
import { AssistantView } from './views/AssistantView'
import { hasPairing } from './services/local'

function App() {
  const [currentTab, setCurrentTab] = useState<TabId>('live')
  const [connectionOpen, setConnectionOpen] = useState(false)
  const [paired, setPaired] = useState(false)
  const connectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    hasPairing().then(setPaired)
  }, [])

  useEffect(() => {
    if (!connectionOpen) return
    const close = (event: MouseEvent) => {
      if (!connectionRef.current?.contains(event.target as Node)) setConnectionOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConnectionOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [connectionOpen])

  return (
    <div className="flex h-dvh min-h-0 min-w-[320px] flex-col overflow-hidden bg-background">
      <header className="relative flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="brand-mark" aria-hidden="true"><BrandMark className="h-[18px] w-[18px]" /></span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-[-0.01em]">Prospect Intelligence</h1>
            <p className="truncate text-[10px] text-muted-foreground">Research and live sales assistance</p>
          </div>
        </div>

        <div ref={connectionRef} className="relative">
          <button
            type="button"
            onClick={() => setConnectionOpen((value) => !value)}
            className={`connection-button ${paired ? 'is-paired' : ''}`}
            aria-label={paired ? 'Dashboard connected' : 'Connect local dashboard'}
            aria-expanded={connectionOpen}
            title={paired ? 'Dashboard connected' : 'Connect local dashboard'}
          >
            {paired ? <ShieldCheck className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            <span className="connection-dot" />
          </button>

          {connectionOpen && (
            <div className="absolute right-0 top-11 z-40">
              <button
                type="button"
                onClick={() => setConnectionOpen(false)}
                className="absolute right-2 top-2 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close connection panel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <SettingsView onPairingChange={setPaired} />
            </div>
          )}
        </div>
      </header>

      <Tabs currentTab={currentTab} onTabChange={setCurrentTab} />

      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {currentTab === 'live' && <LiveView paired={paired} onOpenConnection={() => setConnectionOpen(true)} />}
        {currentTab === 'assistant' && <AssistantView paired={paired} onOpenConnection={() => setConnectionOpen(true)} />}
        {currentTab === 'research' && <ResearchView onOpenConnection={() => setConnectionOpen(true)} />}
      </main>
    </div>
  )
}

export default App
