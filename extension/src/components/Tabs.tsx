import { Bot, Mic, Search } from 'lucide-react'

export type TabId = 'live' | 'assistant' | 'research'

interface TabsProps {
    currentTab: TabId
    onTabChange: (tab: TabId) => void
}

const tabs: Array<{ id: TabId; label: string; icon: typeof Mic }> = [
    { id: 'live', label: 'Live', icon: Mic },
    { id: 'assistant', label: 'Assistant', icon: Bot },
    { id: 'research', label: 'Research', icon: Search },
]

export function Tabs({ currentTab, onTabChange }: TabsProps) {
    return (
        <nav className="flex shrink-0 border-b border-border bg-card px-2" aria-label="Extension sections">
            {tabs.map((tab) => {
                const Icon = tab.icon
                const selected = currentTab === tab.id
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onTabChange(tab.id)}
                        aria-current={selected ? 'page' : undefined}
                        className={`relative flex min-h-12 flex-1 items-center justify-center gap-2 px-2 text-xs font-semibold transition-colors ${
                            selected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {tab.label}
                        <span className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary transition-opacity ${
                            selected ? 'opacity-100' : 'opacity-0'
                        }`} />
                    </button>
                )
            })}
        </nav>
    )
}
