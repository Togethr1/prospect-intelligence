import { useState } from 'react'
import { Search, FileText, Loader2 } from 'lucide-react'
import { useOrganization } from '../contexts/OrganizationContext'

export function SearchView() {
    const [searchQuery, setSearchQuery] = useState('')
    const [results, setResults] = useState<any[]>([])
    const [searching, setSearching] = useState(false)
    useOrganization()

    const handleSearch = async () => {
        if (!searchQuery.trim()) return
        setSearching(true)

        try {
            const response = await fetch('http://localhost:3000/api/context')
            if (!response.ok) throw new Error('Local dashboard is unavailable.')
            const data = await response.json()
            const terms = searchQuery.toLowerCase().split(/\W+/).filter((term) => term.length > 2)
            const matches = (data.knowledgeItems || [])
                .map((item: any) => ({
                    ...item,
                    score: terms.filter((term) => `${item.metadata?.title || ''} ${item.content || ''}`.toLowerCase().includes(term)).length,
                }))
                .filter((item: any) => item.score > 0)
                .sort((a: any, b: any) => b.score - a.score)
                .slice(0, 5)
            setResults(matches)
        } catch (err: any) {
            console.error(err)
            alert('Search failed: ' + err.message)
        } finally {
            setSearching(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-slate-950">
            {/* Header + search */}
            <div className="p-4 space-y-3 border-b border-slate-800 bg-slate-900 shrink-0">
                <div>
                    <h3 className="text-sm font-semibold text-slate-100">Knowledge Search</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Semantic search across your resources.</p>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Ask anything..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                </div>
                <button
                    onClick={handleSearch}
                    disabled={searching}
                    className="w-full bg-amber-500 text-slate-950 py-2 rounded-lg text-sm font-semibold hover:bg-amber-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {searching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {searching ? 'Searching...' : 'Search'}
                </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
                {results.length === 0 && !searching && (
                    <div className="text-center text-slate-500 text-xs mt-12">
                        No results yet. Try searching above.
                    </div>
                )}

                {results.map((item) => (
                    <div
                        key={item.id}
                        className="bg-slate-900 p-3 rounded-lg border border-slate-800"
                    >
                        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-amber-500 uppercase tracking-wide">
                            <FileText className="h-3 w-3" />
                            {item.metadata?.type?.replace('_', ' ') || 'Knowledge'}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            {item.content}
                        </p>
                        {item.metadata?.title && (
                            <p className="text-[10px] text-slate-500 mt-2 border-t border-slate-800 pt-2">
                                {item.metadata.title}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
