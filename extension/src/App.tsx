import { useState } from 'react'
import { Tabs } from './components/Tabs'
import type { TabId } from './components/Tabs'
import { LiveView } from './views/LiveView'
import { ResearchView } from './views/ResearchView'
import { SettingsView } from './views/SettingsView'

function App() {
  const [currentTab, setCurrentTab] = useState<TabId>('research')

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border/50 px-4 py-2.5 flex justify-between items-center shrink-0">
        <h1 className="text-primary font-bold text-sm">AI Sales Assistant</h1>
      </div>

      {/* Tabs */}
      <Tabs currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {currentTab === 'live' && <LiveView />}
        {currentTab === 'research' && <ResearchView />}
        {currentTab === 'settings' && <SettingsView />}
      </div>
    </div>
  )
}

export default App
