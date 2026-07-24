import { LayoutDashboard, Mic, Settings } from 'lucide-react'

export type TabId = 'live' | 'research' | 'settings'

interface TabsProps {
    currentTab: TabId
    onTabChange: (tab: TabId) => void
}

export function Tabs({ currentTab, onTabChange }: TabsProps) {
    return (
        <div className="flex border-b border-border/50 bg-card shrink-0">
            <button
                onClick={() => onTabChange('live')}
                className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition ${
                    currentTab === 'live'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
                <Mic className="h-3.5 w-3.5" />
                Live
            </button>
            <button
                onClick={() => onTabChange('settings')}
                className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition ${
                    currentTab === 'settings'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
                <Settings className="h-3.5 w-3.5" />
                Settings
            </button>
            <button
                onClick={() => onTabChange('research')}
                className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition ${
                    currentTab === 'research'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Research
            </button>
        </div>
    )
}
