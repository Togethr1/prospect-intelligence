'use client'

import { useRef, useState } from 'react'
import {
    Briefcase, FileText, HelpCircle, Lightbulb, Loader2,
    MapPin, Megaphone, MessageCircle, Newspaper, Send,
    Shield, Star, Target, User, Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Person { name: string; role: string; contact: string }
interface Social { platform: string; followers: string }
interface Positioning {
    opening_hook: string
    pitch_angles: string[]
    discovery_questions: string[]
    objection_prep: string[]
    review_trends: string[]
}
interface SalesAssets {
    service_offerings: string[]
    key_suppliers: string[]
    news_and_announcements: string[]
    locations: string[]
    key_staff: Person[]
    employees: Person[]
    company_history: string[]
    social_media_followings: Social[]
    software_stack: string[]
    active_deals: string[]
    google_reviews: { rating?: string; review_count?: string; highlights?: string[] }
    google_reviews_analysis: string[]
    positioning: Positioning
}
interface ChatMessage { role: 'user' | 'assistant'; content: string }

function buildSystemPrompt(assets: SalesAssets, title: string, kb: string[]): string {
    const lines = [
        'You are a pre-call research assistant. A sales rep has analyzed a prospect\'s website and needs help preparing for a cold call.',
        'Be specific, brief, and actionable. Reference actual company details. Keep responses under 200 words unless asked for more.',
        '',
    ]
    if (kb.length > 0) { lines.push('--- SELLER\'S PRODUCT CONTEXT ---'); lines.push(kb.join('\n')); lines.push('') }
    lines.push('--- PROSPECT INTEL ---')
    if (title) lines.push(`Company: ${title}`)
    if (assets.service_offerings.length) lines.push(`Services: ${assets.service_offerings.join(', ')}`)
    if (assets.key_suppliers.length) lines.push(`Suppliers: ${assets.key_suppliers.join(', ')}`)
    if (assets.locations.length) lines.push(`Locations: ${assets.locations.join(', ')}`)
    if (assets.software_stack.length) lines.push(`Software: ${assets.software_stack.join(', ')}`)
    if (assets.active_deals.length) lines.push(`Promotions: ${assets.active_deals.join(', ')}`)
    if (assets.news_and_announcements.length) lines.push(`News: ${assets.news_and_announcements.join('; ')}`)
    if (assets.google_reviews.rating) lines.push(`Google rating: ${assets.google_reviews.rating} (${assets.google_reviews.review_count || '?'} reviews)`)
    if (assets.google_reviews_analysis.length) lines.push(`Review trends: ${assets.google_reviews_analysis.join('; ')}`)
    if (assets.positioning.opening_hook) lines.push(`\nSuggested opener: ${assets.positioning.opening_hook}`)
    return lines.join('\n')
}

export function DashboardResearch() {
    const [url, setUrl] = useState('')
    const [analyzing, setAnalyzing] = useState(false)
    const [status, setStatus] = useState('')
    const [salesAssets, setSalesAssets] = useState<SalesAssets | null>(null)
    const [websiteTitle, setWebsiteTitle] = useState('')
    const [kbItems, setKbItems] = useState<string[]>([])

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const chatBottomRef = useRef<HTMLDivElement>(null)

    const handleAnalyze = async () => {
        const trimmedUrl = url.trim()
        if (!trimmedUrl || analyzing) return

        let fullUrl = trimmedUrl
        if (!/^https?:\/\//i.test(fullUrl)) fullUrl = `https://${fullUrl}`

        setAnalyzing(true)
        setSalesAssets(null)
        setChatMessages([])
        setWebsiteTitle('')
        setKbItems([])
        setStatus('Fetching page...')

        try {
            const res = await fetch('/api/research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: fullUrl }),
            })
            const data = await res.json()
            if (!res.ok) { setStatus(data.error || 'Analysis failed'); return }
            setSalesAssets(data.salesAssets)
            setWebsiteTitle(data.websiteTitle || fullUrl)
            setKbItems(data.kbItems || [])
            setStatus('')
        } catch (err: any) {
            setStatus(err.message || 'Unexpected error')
        } finally {
            setAnalyzing(false)
        }
    }

    const sendChatMessage = async () => {
        const text = chatInput.trim()
        if (!text || chatLoading || !salesAssets) return

        const userMsg: ChatMessage = { role: 'user', content: text }
        const updated = [...chatMessages, userMsg]
        setChatMessages([...updated, { role: 'assistant', content: '' }])
        setChatInput('')
        setChatLoading(true)

        try {
            const res = await fetch('/api/research/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemPrompt: buildSystemPrompt(salesAssets, websiteTitle, kbItems),
                    messages: updated.map(m => ({ role: m.role, content: m.content })),
                }),
            })
            const data = await res.json()
            setChatMessages(prev => {
                const arr = [...prev]
                arr[arr.length - 1] = { role: 'assistant', content: data.content || 'Something went wrong.' }
                return arr
            })
        } catch {
            setChatMessages(prev => {
                const arr = [...prev]
                arr[arr.length - 1] = { role: 'assistant', content: 'Something went wrong.' }
                return arr
            })
        } finally {
            setChatLoading(false)
            setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
    }

    return (
        <div className="space-y-6 w-full flex flex-col items-center">
            
            {/* Main Search Bar matching mockup */}
            <div className="w-full max-w-3xl flex bg-card border border-border/50 rounded-xl p-1 shadow-sm focus-within:border-primary/50 focus-within:glow-primary-subtle transition-all">
                <div className="flex-1 flex items-center px-4">
                    <Search className="w-5 h-5 text-muted-foreground mr-3" />
                    <input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                        placeholder="Enter company name or prospect details..."
                        className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                </div>
                <Button 
                    onClick={handleAnalyze} 
                    disabled={analyzing || !url.trim()} 
                    className="bg-white/10 hover:bg-white/20 text-white rounded-lg px-6 py-2 h-auto text-sm font-medium transition-colors"
                >
                    {analyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {analyzing ? 'Searching' : 'Research'}
                </Button>
            </div>

            {/* Error & Loading Messages below search bar */}
            {(analyzing || status) && (
                <div className="text-center">
                    {analyzing && <p className="text-sm text-primary flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {status}</p>}
                    {!analyzing && status && <p className="text-sm text-destructive">{status}</p>}
                </div>
            )}

            {/* Empty State - only show if no assets and not analyzing */}
            {!salesAssets && !analyzing && !status && (
                <div className="mt-8 flex flex-col items-center justify-center p-16 w-full max-w-3xl">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                        <Search className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-3">Start Your Research</h2>
                    <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
                        Enter a company name or prospect details to get instant AI-powered insights, recent news, key contacts, and personalized talking points for your cold call.
                    </p>
                </div>
            )}

            {/* Results */}
            {salesAssets && (
                <div className="space-y-4 pt-4 w-full max-w-3xl">

                    {/* Analyzed page */}
                    <div className="p-3 rounded-lg border bg-card">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Analyzed Page</p>
                        <p className="text-xs font-medium text-foreground line-clamp-2">{websiteTitle}</p>
                    </div>

                    {/* CALL PLAN */}
                    {(salesAssets.positioning.opening_hook ||
                        salesAssets.positioning.pitch_angles.length > 0 ||
                        salesAssets.positioning.discovery_questions.length > 0 ||
                        salesAssets.positioning.objection_prep.length > 0) && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                <Target className="h-3 w-3 text-primary" /> Call Plan
                            </p>

                            {salesAssets.positioning.opening_hook && (
                                <div className="bg-gradient-to-r from-primary to-amber-400 p-4 rounded-lg">
                                    <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5 text-primary-foreground/60 flex items-center gap-1">
                                        <MessageCircle className="h-3 w-3" /> Suggested Opener
                                    </div>
                                    <p className="text-xs font-semibold text-primary-foreground leading-snug">"{salesAssets.positioning.opening_hook}"</p>
                                </div>
                            )}

                            {salesAssets.positioning.pitch_angles.length > 0 && (
                                <div className="p-3 rounded-lg border bg-card">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-2">
                                        <Lightbulb className="h-3 w-3" /> Pitch Angles
                                    </p>
                                    <ul className="text-xs text-foreground space-y-1.5">
                                        {salesAssets.positioning.pitch_angles.map((a, i) => (
                                            <li key={i} className="flex gap-2">
                                                <span className="text-primary font-bold shrink-0">{i + 1}.</span>{a}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {salesAssets.positioning.discovery_questions.length > 0 && (
                                <div className="p-3 rounded-lg border bg-card">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-2">
                                        <HelpCircle className="h-3 w-3" /> Discovery Questions
                                    </p>
                                    <ul className="text-xs text-foreground space-y-1.5">
                                        {salesAssets.positioning.discovery_questions.map((q, i) => (
                                            <li key={i} className="flex gap-2">
                                                <span className="text-muted-foreground shrink-0">Q{i + 1}.</span>{q}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {salesAssets.positioning.objection_prep.length > 0 && (
                                <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1 mb-2">
                                        <Shield className="h-3 w-3" /> Objection Prep
                                    </p>
                                    <ul className="text-xs text-foreground/80 space-y-2">
                                        {salesAssets.positioning.objection_prep.map((obj, i) => (
                                            <li key={i} className="flex gap-2">
                                                <span className="text-primary/50 shrink-0">•</span>{obj}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* COMPANY INTEL */}
                    {salesAssets.company_history.length > 0 && (
                        <div className="p-3 rounded-lg border bg-card">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
                                <Newspaper className="h-3 w-3" /> Company History
                            </p>
                            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                                {salesAssets.company_history.slice(0, 5).map((item, i) => <li key={i}>{item}</li>)}
                            </ul>
                        </div>
                    )}

                    {salesAssets.service_offerings.length > 0 && (
                        <div className="p-3 rounded-lg border bg-card">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
                                <Briefcase className="h-3 w-3" /> Services & Products
                            </p>
                            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                                {salesAssets.service_offerings.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                        </div>
                    )}

                    {salesAssets.key_suppliers.length > 0 && (
                        <div className="p-3 rounded-lg border bg-card">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
                                <Briefcase className="h-3 w-3" /> Brand Suppliers
                            </p>
                            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                                {salesAssets.key_suppliers.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                        </div>
                    )}

                    {salesAssets.news_and_announcements.length > 0 && (
                        <div className="p-3 rounded-lg border border-sky-800/30 bg-sky-950/30">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400 flex items-center gap-1.5 mb-2">
                                <Newspaper className="h-3 w-3" /> Recent News
                            </p>
                            <ul className="text-xs text-sky-300/80 space-y-1.5">
                                {salesAssets.news_and_announcements.slice(0, 4).map((n, i) => (
                                    <li key={i} className="flex gap-2"><span className="opacity-40">•</span>{n}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {salesAssets.active_deals.length > 0 && (
                        <div className="p-3 rounded-lg border border-emerald-800/30 bg-emerald-950/30">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 mb-2">
                                <Megaphone className="h-3 w-3" /> Active Promotions
                            </p>
                            <ul className="text-xs text-emerald-300/80 space-y-1">
                                {salesAssets.active_deals.slice(0, 4).map((d, i) => <li key={i}>• {d}</li>)}
                            </ul>
                        </div>
                    )}

                    {salesAssets.locations.length > 0 && (
                        <div className="p-3 rounded-lg border bg-card">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
                                <MapPin className="h-3 w-3" /> Locations
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {salesAssets.locations.slice(0, 6).map((loc, i) => (
                                    <span key={i} className="text-[10px] px-2 py-0.5 bg-muted border border-border rounded-full text-muted-foreground">{loc}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {salesAssets.software_stack.length > 0 && (
                        <div className="p-3 rounded-lg border bg-card">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
                                <Briefcase className="h-3 w-3" /> Software Stack
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {salesAssets.software_stack.slice(0, 8).map((tool, i) => (
                                    <span key={i} className="text-[10px] px-2 py-0.5 bg-muted border border-border rounded-full text-muted-foreground">{tool}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {salesAssets.employees.length > 0 && (
                        <div className="p-3 rounded-lg border bg-card">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
                                <User className="h-3 w-3" /> Employees Mentioned
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                                {salesAssets.employees.slice(0, 6).map((e, i) => (
                                    <li key={i}>{e.name}{e.role ? ` — ${e.role}` : ''}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {salesAssets.social_media_followings.length > 0 && (
                        <div className="p-3 rounded-lg border bg-card">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
                                <Megaphone className="h-3 w-3" /> Social Media
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                                {salesAssets.social_media_followings.slice(0, 5).map((item, i) => (
                                    <li key={i}>{item.platform}{item.followers ? ` — ${item.followers}` : ''}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {(salesAssets.google_reviews?.rating || (salesAssets.google_reviews?.highlights?.length ?? 0) > 0) && (
                        <div className="p-3 rounded-lg border bg-card">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
                                <Star className="h-3 w-3" /> Google Reviews
                            </p>
                            <div className="text-xs text-muted-foreground space-y-1">
                                {salesAssets.google_reviews.rating && (
                                    <div>Rating: <span className="text-primary font-medium">{salesAssets.google_reviews.rating}</span>
                                        {salesAssets.google_reviews.review_count && ` (${salesAssets.google_reviews.review_count} reviews)`}
                                    </div>
                                )}
                                {salesAssets.google_reviews.highlights && salesAssets.google_reviews.highlights.length > 0 && (
                                    <ul className="list-disc list-inside mt-1 space-y-1">
                                        {salesAssets.google_reviews.highlights.slice(0, 3).map((h, i) => (
                                            <li key={i} className="line-clamp-2">{h}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="p-3 rounded-lg border border-primary/20 bg-card">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 mb-2">
                            <Lightbulb className="h-3 w-3" /> Review Trends
                        </p>
                        {salesAssets.google_reviews_analysis.length > 0 ? (
                            <ul className="text-xs text-foreground/70 space-y-1">
                                {salesAssets.google_reviews_analysis.map((item, i) => (
                                    <li key={i}>• {item}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-muted-foreground italic">No review signals found.</p>
                        )}
                    </div>

                    {/* CHAT */}
                    <div className="rounded-lg border bg-card overflow-hidden">
                        <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
                            <MessageCircle className="h-3.5 w-3.5 text-primary" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Ask about this prospect</span>
                        </div>

                        {chatMessages.length > 0 && (
                            <div className="max-h-64 overflow-y-auto p-3 space-y-2.5">
                                {chatMessages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                                            msg.role === 'user'
                                                ? 'bg-primary text-primary-foreground font-medium rounded-br-sm'
                                                : 'bg-muted text-foreground rounded-bl-sm'
                                        }`}>
                                            {msg.content || (chatLoading && i === chatMessages.length - 1
                                                ? <span className="animate-pulse text-muted-foreground">...</span>
                                                : null
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div ref={chatBottomRef} />
                            </div>
                        )}

                        <div className="p-3 flex gap-2 items-end border-t border-border">
                            <textarea
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() }
                                }}
                                placeholder="e.g. Draft an opening email for this company..."
                                rows={1}
                                className="flex-1 text-xs bg-muted border border-border text-foreground placeholder:text-muted-foreground rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring/50"
                            />
                            <button
                                onClick={sendChatMessage}
                                disabled={chatLoading || !chatInput.trim()}
                                className="bg-primary text-primary-foreground p-2 rounded-lg hover:bg-primary/90 disabled:opacity-40 transition shrink-0"
                            >
                                <Send className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                </div>
            )}
        </div>
    )
}
