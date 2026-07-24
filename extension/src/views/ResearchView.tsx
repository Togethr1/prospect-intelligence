import { Settings, FileText as LucideFileText } from 'lucide-react'
import { DEFAULT_FIELDS } from '../lib/fields'
import type { FieldConfig } from '../lib/fields'
import { CustomizeFieldsModal } from '../components/CustomizeFieldsModal'
import { useMemo, useRef, useState, useEffect } from 'react'
import {
    Briefcase, ExternalLink, HelpCircle, LayoutDashboard, Lightbulb,
    Loader2, MapPin, Megaphone, MessageCircle, Newspaper,
    Send, Shield, Star, Target, User
} from 'lucide-react'
import { analysisService, type SalesAssets } from '../services/analysis'
import { isPublicPageUrl } from '../lib/public-page'
import {
    getLocalContext, listAiProviders, listIntelligenceProviders, listReviewProviders, resolveCrm, runAiProvider, runIntelligenceProvider, runReviewProvider, saveLocalResearch, sendResearchChat,
    type AiSynthesisResult, type CrmContext, type IntelligenceProvider, type IntelligenceResult, type ReviewInsightsResult,
} from '../services/local'

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

// Crawls up to 8 internal subpages from the current tab to gather brand/service/supplier data
// that only appears on deeper pages (e.g. Carrier on /heating, not on the homepage).
async function crawlSubpages(tabId: number, currentUrl: string, origin: string): Promise<string> {
    const navResults = await chrome.scripting.executeScript({
        target: { tabId },
        func: (expectedOrigin: string) => {
            return Array.from(document.querySelectorAll('a[href]'))
                .map(a => {
                    try {
                        const href = (a as HTMLAnchorElement).href
                        const u = new URL(href)
                        if (u.origin !== expectedOrigin) return null
                        const path = u.pathname.toLowerCase()
                        if (/\/(blog|news|careers|privacy|terms|login|cart|checkout|account|wp-admin|sitemap|feed)/.test(path)) return null
                        return u.origin + u.pathname
                    } catch { return null }
                })
                .filter((url): url is string => Boolean(url))
                .filter((url, i, arr) => arr.indexOf(url) === i)
                .slice(0, 25)
        },
        args: [origin],
    })

    const allLinks = (navResults[0]?.result || []) as string[]
    const cleanCurrentUrl = currentUrl.split('?')[0].split('#')[0]

    const preferredTerms = [
        'heating', 'cooling', 'plumbing', 'hvac', 'service', 'product',
        'equipment', 'brand', 'about', 'commercial', 'residential',
        'repair', 'install', 'maintenance', 'air', 'electric', 'gas',
    ]
    const topLinks = allLinks
        .filter(u => u !== cleanCurrentUrl)
        .map(u => {
            const path = new URL(u).pathname.toLowerCase()
            const score = preferredTerms.filter(t => path.includes(t)).length
            return { url: u, score }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(s => s.url)

    if (topLinks.length === 0) return ''

    const crawlResults = await chrome.scripting.executeScript({
        target: { tabId },
        func: async (urls: string[]) => {
            const texts: string[] = []
            const readLimitedText = async (response: Response, maxBytes: number) => {
                const declared = Number(response.headers.get('content-length') || '0')
                if (Number.isFinite(declared) && declared > maxBytes) return ''
                if (!response.body) return ''
                const reader = response.body.getReader()
                const decoder = new TextDecoder()
                let total = 0
                let result = ''
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    total += value.byteLength
                    if (total > maxBytes) {
                        await reader.cancel()
                        return ''
                    }
                    result += decoder.decode(value, { stream: true })
                }
                return result + decoder.decode()
            }
            for (const pageUrl of urls) {
                try {
                    const controller = new AbortController()
                    const timer = setTimeout(() => controller.abort(), 6000)
                    const res = await fetch(pageUrl, {
                        signal: controller.signal,
                        redirect: 'error',
                        credentials: 'omit',
                        referrerPolicy: 'no-referrer',
                    })
                    clearTimeout(timer)
                    if (!res.ok) continue
                    const contentType = res.headers.get('content-type') || ''
                    if (!contentType.includes('text/html')) continue
                    const html = await readLimitedText(res, 250_000)
                    if (!html) continue
                    const parser = new DOMParser()
                    const doc = parser.parseFromString(html, 'text/html')
                    doc.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove())
                    const text = (doc.body?.innerText || '').replace(/\s+/g, ' ').trim()
                    if (text.length > 100) texts.push(`[PAGE: ${pageUrl}]\n${text.substring(0, 5000)}`)
                } catch { /* skip pages that fail or timeout */ }
            }
            return texts.join('\n\n')
        },
        args: [topLinks],
    })

    return crawlResults[0]?.result || ''
}

export function ResearchView({ onOpenConnection }: { onOpenConnection?: () => void }) {
    const [analyzing, setAnalyzing] = useState(false)
    const [pageContext, setPageContext] = useState<string | null>(null)
    const [salesAssets, setSalesAssets] = useState<SalesAssets | null>(null)
    const [statusMessage, setStatusMessage] = useState<string>('')
    const [companyQuery, setCompanyQuery] = useState<string>('')
    const [autoCompanyQuery, setAutoCompanyQuery] = useState<string>('')
    const [knowledgeBaseItems, setKnowledgeBaseItems] = useState<string[]>([])
    const [websiteTitle, setWebsiteTitle] = useState<string>('')
    const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>(DEFAULT_FIELDS)
    const [showCustomizeModal, setShowCustomizeModal] = useState(false)
    const [crmContext, setCrmContext] = useState<CrmContext | null>(null)
    const [analyzedUrl, setAnalyzedUrl] = useState('')
    const [intelligenceProviders, setIntelligenceProviders] = useState<IntelligenceProvider[]>([])
    const [intelligenceResults, setIntelligenceResults] = useState<Record<string, IntelligenceResult>>({})
    const [providerBusy, setProviderBusy] = useState<string | null>(null)
    const [aiProviders, setAiProviders] = useState<IntelligenceProvider[]>([])
    const [aiResults, setAiResults] = useState<Record<string, AiSynthesisResult>>({})
    const [aiProviderBusy, setAiProviderBusy] = useState<string | null>(null)
    const [reviewProviders, setReviewProviders] = useState<IntelligenceProvider[]>([])
    const [reviewResult, setReviewResult] = useState<ReviewInsightsResult | null>(null)
    const [reviewProviderBusy, setReviewProviderBusy] = useState<string | null>(null)

    useEffect(() => {
        chrome.storage?.local?.get('fieldConfigs', (res) => {
            if (Array.isArray(res.fieldConfigs)) {
                const saved = res.fieldConfigs as FieldConfig[]
                const savedById = new Map(saved.map((field) => [field.id, field]))
                const missingDefaults = DEFAULT_FIELDS
                    .filter((field) => !savedById.has(field.id))
                    .map((field, index) => ({ ...field, order: saved.length + index }))
                setFieldConfigs([...saved, ...missingDefaults])
            }
        })
    }, [])

    const handleSaveFields = (newFields: FieldConfig[]) => {
        setFieldConfigs(newFields)
        chrome.storage?.local?.set({ fieldConfigs: newFields })
    }

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const chatBottomRef = useRef<HTMLDivElement>(null)

    const emptyAssets: SalesAssets = useMemo(() => ({
        service_offerings: [],
        key_suppliers: [],
        news_and_announcements: [],
        locations: [],
        key_staff: [],
        employees: [],
        company_history: [],
        social_media_followings: [],
        google_reviews: {},
        google_reviews_analysis: [],
        software_stack: [],
        active_deals: [],
        positioning: {
            opening_hook: '',
            pitch_angles: [],
            discovery_questions: [],
            objection_prep: [],
            review_trends: [],
        },
    }), [])

    const mergeAssets = (base: SalesAssets | null, override: Partial<SalesAssets>) => {
        return {
            ...emptyAssets,
            ...base,
            ...override,
            google_reviews: {
                ...(base?.google_reviews ?? {}),
                ...(override.google_reviews ?? {}),
            },
            positioning: {
                ...(base?.positioning ?? emptyAssets.positioning),
                ...(override.positioning ?? {}),
            },
        }
    }

    const deriveCompanyQuery = (meta: {
        title?: string
        metaSiteName?: string
        h1Text?: string
        hostname?: string
    }) => {
        const clean = (value?: string) => (value || '').replace(/\s+/g, ' ').trim()
        const fromMeta = clean(meta.metaSiteName)
        if (fromMeta) return fromMeta
        const fromH1 = clean(meta.h1Text)
        if (fromH1) return fromH1
        const title = clean(meta.title)
        if (title) {
            const splitTitle = title.split('|')[0].split('-')[0].trim()
            if (splitTitle) return splitTitle
        }
        const host = clean(meta.hostname).replace(/^www\./, '')
        if (!host) return ''
        const root = host.split('.')[0]
        return root ? root.charAt(0).toUpperCase() + root.slice(1) : ''
    }

    const handleAnalyze = async () => {
        setAnalyzing(true)
        setSalesAssets(null)
        setChatMessages([])
        setStatusMessage('Initializing...')
        setPageContext(null)
        setKnowledgeBaseItems([])
        setWebsiteTitle('')
        setCrmContext(null)
        setAnalyzedUrl('')
        setIntelligenceResults({})
        setAiResults({})
        setReviewResult(null)

        const timeoutPromise = new Promise((_, reject) => {
            const id = setTimeout(() => {
                clearTimeout(id)
                reject(new Error('Analysis timed out after 60 seconds'))
            }, 60000)
        })

        const analysisPromise = async () => {
            if (!chrome.tabs) {
                throw new Error('Extensions API not available (are you running in browser mode?)')
            }

            setStatusMessage('Fetching context from local dashboard...')
            const contextData = await getLocalContext()
            const kbItems = contextData.knowledgeItems.map((item) => {
                const type = item.metadata?.type || 'note'
                const cap = type === 'document' ? 500 : Number.POSITIVE_INFINITY
                return `[${type}] ${item.content.slice(0, cap)}`
            })
            setKnowledgeBaseItems(kbItems)

            setStatusMessage('Reading page...')
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
            if (!tab?.id) throw new Error('No active tab found')

            const tabUrl = tab.url || ''
            if (!isPublicPageUrl(tabUrl)) {
                setPageContext(null)
                setStatusMessage('Only public HTTP or HTTPS prospect websites can be analyzed.')
                return
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const h1 = document.querySelector('h1')
                    const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || ''
                    const appName = document.querySelector('meta[name="application-name"]')?.getAttribute('content') || ''
                    const metaSiteName = ogSiteName || appName
                    return {
                        title: document.title,
                        url: window.location.href,
                        text: document.body.innerText.replace(/\s+/g, ' ').substring(0, 25000),
                        metaSiteName,
                        h1Text: h1?.textContent || '',
                        hostname: window.location.hostname,
                    }
                },
            })

            const { title, text, url, metaSiteName, h1Text, hostname } = results[0].result || {
                title: '', url: '', text: '', metaSiteName: '', h1Text: '', hostname: '',
            }

            if (text && text.length > 50) {
                setPageContext(title)
                setWebsiteTitle(title)
                setAnalyzedUrl(url)
                try {
                    setCrmContext(await resolveCrm(url))
                    setIntelligenceProviders(await listIntelligenceProviders())
                    setAiProviders(await listAiProviders())
                    setReviewProviders(await listReviewProviders())
                } catch (error) {
                    if (error instanceof Error && error.message === 'PAIRING_REQUIRED') {
                        setStatusMessage('Connect the extension from the link icon to load CRM and provider context.')
                        onOpenConnection?.()
                    }
                }

                setStatusMessage('Crawling subpages...')
                const subpageText = await crawlSubpages(tab.id, url, new URL(url).origin)
                const combinedText = [text, subpageText].filter(Boolean).join('\n\n').substring(0, 40000)

                const detectedQuery = deriveCompanyQuery({ title, metaSiteName, h1Text, hostname })
                if (!companyQuery.trim() && detectedQuery) setCompanyQuery(detectedQuery)
                setAutoCompanyQuery(detectedQuery)
                let nextAssets = mergeAssets(null, {})

                setStatusMessage('Running local analysis...')
                const graphAssets = await analysisService.analyzeResearch({
                    websiteText: combinedText,
                    websiteTitle: title,
                    websiteUrl: url,
                    knowledgeBaseItems: kbItems,
                    fieldConfigs,
                })
                nextAssets = mergeAssets(nextAssets, graphAssets)

                setSalesAssets(nextAssets)
                await saveLocalResearch(url, title || hostname, nextAssets)
                setStatusMessage('')
            } else {
                setPageContext('Not enough text found on page to analyze.')
            }
        }

        try {
            await Promise.race([analysisPromise(), timeoutPromise])
        } catch (err: unknown) {
            let message = err instanceof Error ? err.message : 'Unknown error'
            if (message === 'PAIRING_REQUIRED') {
                message = 'Connect and approve the extension before analyzing a website.'
                onOpenConnection?.()
            }
            if (message.includes('Cannot access contents') || message.includes('Missing host permission')) {
                message = 'Cannot analyze this page. Browser security prevents extensions from accessing system pages. Try a normal website.'
            }
            setStatusMessage(message)
        } finally {
            setAnalyzing(false)
        }
    }

    const runProvider = async (provider: IntelligenceProvider) => {
        if (!analyzedUrl || providerBusy) return
        setProviderBusy(provider.id)
        setStatusMessage(`Requesting ${provider.name}. This may consume provider credits...`)
        try {
            const result = await runIntelligenceProvider(provider.id, analyzedUrl)
            setIntelligenceResults((current) => ({ ...current, [provider.id]: result }))
            setStatusMessage('')
        } catch (error) {
            setStatusMessage(error instanceof Error ? error.message : `${provider.name} lookup failed.`)
        } finally {
            setProviderBusy(null)
        }
    }

    const runAi = async (provider: IntelligenceProvider) => {
        if (!salesAssets || aiProviderBusy) return
        setAiProviderBusy(provider.id)
        setStatusMessage(`Requesting ${provider.name}. This may incur provider charges...`)
        const aiSafeWebsiteAnalysis = {
            ...salesAssets,
            google_reviews: {
                rating: salesAssets.google_reviews.rating,
                review_count: salesAssets.google_reviews.review_count,
            },
        }
        const prompt = [
            `Website: ${websiteTitle}`,
            `URL: ${analyzedUrl}`,
            `Website analysis: ${JSON.stringify(aiSafeWebsiteAnalysis)}`,
            crmContext ? `CRM context: ${JSON.stringify(crmContext)}` : '',
            Object.values(intelligenceResults).length ? `Enrichment context: ${JSON.stringify(Object.values(intelligenceResults))}` : '',
            'Produce a verified account summary, three call angles, five discovery questions, likely objections, and a concise opener. Label suggestions clearly.',
        ].filter(Boolean).join('\n\n').slice(0, 40_000)
        try {
            const result = await runAiProvider(provider.id, prompt)
            setAiResults((current) => ({ ...current, [provider.id]: result }))
            setStatusMessage('')
        } catch (error) {
            setStatusMessage(error instanceof Error ? error.message : `${provider.name} synthesis failed.`)
        } finally {
            setAiProviderBusy(null)
        }
    }

    const runReviewLookup = async (provider: IntelligenceProvider) => {
        if (!salesAssets || reviewProviderBusy) return
        setReviewProviderBusy(provider.id)
        setStatusMessage(`Requesting ${provider.name}. This may consume provider quota or incur charges...`)
        const fallbackDomain = (() => { try { return new URL(analyzedUrl).hostname } catch { return analyzedUrl } })()
        const query = [websiteTitle || fallbackDomain, salesAssets.locations?.[0]].filter(Boolean).join(', ').slice(0, 500)
        try {
            const result = await runReviewProvider(provider.id, query)
            setReviewResult(result)
            setSalesAssets((current) => current ? ({
                ...current,
                google_reviews: {
                    rating: result.rating?.toFixed(1),
                    review_count: result.reviewCount?.toLocaleString(),
                    highlights: result.reviews.slice(0, 3).map((review) => {
                        const attribution = [review.author, review.rating ? `${review.rating}★` : ''].filter(Boolean).join(' · ')
                        return attribution ? `${attribution}: ${review.text}` : review.text
                    }),
                },
                google_reviews_analysis: result.trends,
                positioning: { ...current.positioning, review_trends: result.trends },
            }) : current)
            setStatusMessage('')
        } catch (error) {
            setStatusMessage(error instanceof Error ? error.message : `${provider.name} review lookup failed.`)
        } finally {
            setReviewProviderBusy(null)
        }
    }

    const buildChatSystemPrompt = (): string => {
        const intel = salesAssets
        const lines: string[] = [
            'You are a pre-call research assistant. A sales rep has just analyzed a prospect\'s website and needs help preparing for a cold call.',
            'Be specific, brief, and actionable. Reference the actual company details when relevant. Keep responses under 200 words unless asked for something longer.',
            '',
        ]

        if (knowledgeBaseItems.length > 0) {
            lines.push('--- SELLER\'S PRODUCT CONTEXT ---')
            lines.push(knowledgeBaseItems.join('\n'))
            lines.push('')
        }

        if (intel) {
            lines.push('--- PROSPECT INTEL ---')
            if (websiteTitle) lines.push(`Company: ${websiteTitle}`)
            if (intel.service_offerings.length) lines.push(`Services: ${intel.service_offerings.join(', ')}`)
            if (intel.key_suppliers.length) lines.push(`Suppliers: ${intel.key_suppliers.join(', ')}`)
            if (intel.locations.length) lines.push(`Locations: ${intel.locations.join(', ')}`)
            if (intel.software_stack.length) lines.push(`Software: ${intel.software_stack.join(', ')}`)
            if (intel.active_deals.length) lines.push(`Promotions: ${intel.active_deals.join(', ')}`)
            if (intel.news_and_announcements.length) lines.push(`Recent news: ${intel.news_and_announcements.join('; ')}`)
            if (intel.google_reviews.rating) lines.push(`Google rating: ${intel.google_reviews.rating} (${intel.google_reviews.review_count || '?'} reviews)`)
            if (intel.google_reviews_analysis.length) lines.push(`Review trends: ${intel.google_reviews_analysis.join('; ')}`)

            const allPeople = [
                ...intel.employees.map(e => `${e.name} (${e.role})`),
                ...intel.key_staff.map(e => `${e.name} (${e.role})`),
            ]
            if (allPeople.length) lines.push(`Key people: ${allPeople.slice(0, 8).join(', ')}`)

            if (intel.positioning.opening_hook) lines.push(`\nSuggested opener: ${intel.positioning.opening_hook}`)
        }

        return lines.join('\n')
    }

    const sendChatMessage = async () => {
        const text = chatInput.trim()
        if (!text || chatLoading) return

        const userMsg: ChatMessage = { role: 'user', content: text }
        const updatedMessages = [...chatMessages, userMsg]
        setChatMessages(updatedMessages)
        setChatInput('')
        setChatLoading(true)

        try {
            const data = await sendResearchChat(buildChatSystemPrompt(), updatedMessages)
            setChatMessages(prev => [...prev, { role: 'assistant', content: data.content }])
            chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        } catch {
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'Start the local dashboard and try again.' }])
        } finally {
            setChatLoading(false)
        }
    }

    return (
        <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
            {/* Header */}
            <header className="view-header">
                <div>
                    <h2>Pre-Call Research</h2>
                    <p>Analyze any prospect website for call intelligence.</p>
                </div>
                <button
                    onClick={() => setShowCustomizeModal(true)}
                    className="research-settings-button"
                    title="Customize Signals"
                    aria-label="Customize research signals"
                >
                    <Settings className="h-4 w-4" />
                </button>
            </header>

            {/* Scrollable content */}
            <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">

                {/* Company name override */}
                <div className="research-card">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        Company (auto-detected)
                    </label>
                    <input
                        type="text"
                        value={companyQuery}
                        onChange={(e) => setCompanyQuery(e.target.value)}
                        placeholder="e.g. Acme Plumbing, Phoenix AZ"
                        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    {autoCompanyQuery && (
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                            Detected: {autoCompanyQuery}
                        </p>
                    )}
                </div>

                {/* Empty state */}
                {!pageContext && !analyzing && (
                    <div className="research-card research-empty">
                        <ExternalLink className="h-6 w-6 opacity-40" />
                        Navigate to a prospect's website, then click Analyze.
                    </div>
                )}

                {/* Loading */}
                {analyzing && (
                    <div className="flex flex-col items-center justify-center py-10 space-y-3">
                        <Loader2 className="h-7 w-7 animate-spin text-primary" />
                        <p className="text-xs text-muted-foreground font-medium">{statusMessage || 'Analyzing...'}</p>
                    </div>
                )}

                {/* Analyzed page label */}
                {pageContext && (
                    <div className="bg-card p-3 rounded-lg border border-border">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Analyzed Page</p>
                        <p className="text-xs font-medium text-foreground line-clamp-2">{pageContext}</p>
                    </div>
                )}

                {crmContext && fieldConfigs.find((field) => field.id === 'crm_context')?.enabled !== false && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">CRM context · HubSpot</p>
                        {crmContext.disconnected ? (
                            <p className="mt-2 text-xs text-muted-foreground">Connect HubSpot in the dashboard Settings page.</p>
                        ) : crmContext.match === 'none' || !crmContext.account ? (
                            <p className="mt-2 text-xs text-muted-foreground">No exact company-domain match returned.</p>
                        ) : (
                            <div className="mt-2">
                                <p className="text-sm font-semibold text-foreground">{crmContext.account.name}</p>
                                <p className="mt-0.5 text-[10px] text-muted-foreground">{[crmContext.account.lifecycle, crmContext.account.industry].filter(Boolean).join(' · ') || crmContext.account.domain}</p>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div className="rounded-md border border-border/50 bg-card p-2">
                                        <p className="text-[10px] text-muted-foreground">Contacts</p>
                                        <p className="mt-1 text-lg font-semibold">{crmContext.contacts.length}</p>
                                    </div>
                                    <div className="rounded-md border border-border/50 bg-card p-2">
                                        <p className="text-[10px] text-muted-foreground">Deals</p>
                                        <p className="mt-1 text-lg font-semibold">{crmContext.opportunities.length}</p>
                                    </div>
                                </div>
                                {crmContext.contacts.slice(0, 3).map((contact) => (
                                    <div key={contact.id} className="mt-2 text-xs">
                                        <span className="font-medium">{contact.name}</span>
                                        <span className="text-muted-foreground"> · {contact.title || 'Title unavailable'}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {pageContext && intelligenceProviders.length > 0 && (
                    <div className="rounded-lg border border-border/50 bg-card p-3">
                        <p className="text-xs font-semibold text-foreground">Optional enrichment</p>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Run individually—these providers may consume account credits.</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {intelligenceProviders.map((provider) => (
                                <button
                                    key={provider.id}
                                    onClick={() => runProvider(provider)}
                                    disabled={Boolean(providerBusy)}
                                    className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-[10px] font-medium text-foreground hover:border-primary/50 disabled:opacity-50"
                                >
                                    {providerBusy === provider.id ? 'Running…' : `Run ${provider.name}`} · {provider.cost}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {fieldConfigs.find((field) => field.id === 'enrichment_results')?.enabled !== false && Object.values(intelligenceResults).map((result) => (
                    <div key={result.provider} className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <p className="text-xs font-semibold text-foreground">{result.providerName}</p>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{result.costNotice}</p>
                        {result.company && (
                            <div className="mt-2">
                                <p className="text-xs font-medium">{result.company.name || result.domain}</p>
                                <p className="text-[10px] text-muted-foreground">
                                    {[result.company.industry, result.company.employeeCount ? `${result.company.employeeCount} employees` : '', result.company.annualRevenue].filter(Boolean).join(' · ')}
                                </p>
                            </div>
                        )}
                        {!result.company && (
                            <p className="mt-2 text-[10px] text-muted-foreground">No exact-domain company match returned.</p>
                        )}
                        {result.contacts.slice(0, 5).map((contact) => (
                            <div key={contact.id} className="mt-2 border-t border-border/50 pt-2">
                                <p className="text-xs font-medium">{contact.name}</p>
                                <p className="text-[10px] text-muted-foreground">{[contact.title, contact.email, contact.phone].filter(Boolean).join(' · ')}</p>
                            </div>
                        ))}
                    </div>
                ))}

                {salesAssets && aiProviders.length > 0 && (
                    <div className="rounded-lg border border-border/50 bg-card p-3">
                        <p className="text-xs font-semibold text-foreground">Optional AI synthesis</p>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Each request is explicit and may incur charges in your provider account.</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {aiProviders.map((provider) => (
                                <button
                                    key={provider.id}
                                    onClick={() => runAi(provider)}
                                    disabled={Boolean(aiProviderBusy)}
                                    className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-[10px] font-medium text-foreground hover:border-primary/50 disabled:opacity-50"
                                >
                                    {aiProviderBusy === provider.id ? 'Running…' : `Run ${provider.name}`}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {salesAssets && reviewProviders.length > 0 && (
                    <div className="rounded-lg border border-border/50 bg-card p-3">
                        <p className="text-xs font-semibold text-foreground">Review intelligence</p>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Each lookup is explicit and may consume provider quota or credits.</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {reviewProviders.map((provider) => (
                                <button
                                    key={provider.id}
                                    onClick={() => runReviewLookup(provider)}
                                    disabled={Boolean(reviewProviderBusy)}
                                    className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-[10px] font-medium text-foreground hover:border-primary/50 disabled:opacity-50"
                                >
                                    {reviewProviderBusy === provider.id ? 'Running…' : `Get reviews · ${provider.name}`}
                                </button>
                            ))}
                        </div>
                        {reviewResult && fieldConfigs.find((field) => field.id === 'review_provider_output')?.enabled !== false && (
                            <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-2 text-[10px] leading-4">
                                <p className="font-medium text-foreground">{reviewResult.placeName} · {reviewResult.providerName}</p>
                                <p className="mt-1 text-muted-foreground">{reviewResult.coverageNotice}</p>
                                <p className="mt-1 text-primary/90">{reviewResult.costNotice}</p>
                            </div>
                        )}
                    </div>
                )}

                {fieldConfigs.find((field) => field.id === 'ai_synthesis')?.enabled !== false && Object.values(aiResults).map((result) => (
                    <div key={result.provider} className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <p className="text-xs font-semibold text-foreground">{result.providerName} · {result.model}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{result.costNotice}</p>
                        <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-foreground/90">{result.content}</p>
                    </div>
                ))}

                {salesAssets && (
                    <div className="space-y-3">

                        {fieldConfigs.filter(f => f.enabled).sort((a, b) => a.order - b.order).map(field => {
                            if (field.isCustom) {
                                const data = salesAssets.custom_fields?.[field.id] || [];
                                if (data.length === 0) return null;
                                return (
                                    <div key={field.id} className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                                        <p className="text-[10px] font-bold text-primary/90 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                            <LucideFileText className="h-3 w-3" /> {field.label}
                                        </p>
                                        <ul className="text-xs text-primary-foreground/80 space-y-1">
                                            {data.map((item: string, i: number) => (
                                                <li key={i}>• {item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            }

                            switch (field.id) {
                                case 'call_plan':
                                    if (!salesAssets.positioning.opening_hook && salesAssets.positioning.pitch_angles.length === 0 && salesAssets.positioning.discovery_questions.length === 0 && salesAssets.positioning.objection_prep.length === 0) return null;
                                    return (
                                        <div key={field.id} className="space-y-2">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                                <Target className="h-3 w-3 text-primary" /> Call Plan
                                            </p>

                                            {salesAssets.positioning.opening_hook && (
                                                <div className="rounded-lg bg-primary p-4">
                                                    <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5 text-primary-foreground/80 flex items-center gap-1">
                                                        <MessageCircle className="h-3 w-3" /> Suggested Opener
                                                    </div>
                                                    <p className="text-xs font-semibold text-primary-foreground leading-snug">"{salesAssets.positioning.opening_hook}"</p>
                                                </div>
                                            )}

                                            {salesAssets.positioning.pitch_angles.length > 0 && (
                                                <div className="bg-card p-3 rounded-lg border border-border/50">
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-2">
                                                        <Lightbulb className="h-3 w-3" /> Pitch Angles
                                                    </p>
                                                    <ul className="text-xs text-foreground/80 space-y-1.5">
                                                        {salesAssets.positioning.pitch_angles.map((angle, i) => (
                                                            <li key={i} className="flex gap-2">
                                                                <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                                                                {angle}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {salesAssets.positioning.discovery_questions.length > 0 && (
                                                <div className="bg-card p-3 rounded-lg border border-border/50">
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-2">
                                                        <HelpCircle className="h-3 w-3" /> Discovery Questions
                                                    </p>
                                                    <ul className="text-xs text-foreground/80 space-y-1.5">
                                                        {salesAssets.positioning.discovery_questions.map((q, i) => (
                                                            <li key={i} className="flex gap-2">
                                                                <span className="text-muted-foreground/80 shrink-0">Q{i + 1}.</span>
                                                                {q}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {salesAssets.positioning.objection_prep.length > 0 && (
                                                <div className="bg-primary/10 p-3 rounded-lg border border-primary/30">
                                                    <p className="text-[10px] font-bold text-primary/90 uppercase tracking-wide flex items-center gap-1 mb-2">
                                                        <Shield className="h-3 w-3" /> Objection Prep
                                                    </p>
                                                    <ul className="text-xs text-primary-foreground/80 space-y-2">
                                                        {salesAssets.positioning.objection_prep.map((obj, i) => (
                                                            <li key={i} className="flex gap-2">
                                                                <span className="text-primary/50 shrink-0">•</span>
                                                                {obj}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    );

                                case 'company_history':
                                    if (salesAssets.company_history.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Newspaper className="h-3 w-3" /> Company History
                                            </p>
                                            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                                                {salesAssets.company_history.slice(0, 5).map((item, i) => (
                                                    <li key={i}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    );

                                case 'service_offerings':
                                    if (salesAssets.service_offerings.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Briefcase className="h-3 w-3" /> Services & Products
                                            </p>
                                            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                                                {salesAssets.service_offerings.map((s, i) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>
                                    );

                                case 'key_suppliers':
                                    if (salesAssets.key_suppliers.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Briefcase className="h-3 w-3" /> Brand Suppliers
                                            </p>
                                            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                                                {salesAssets.key_suppliers.map((s, i) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>
                                    );

                                case 'news_and_announcements':
                                    if (salesAssets.news_and_announcements.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-sky-950/30 p-3 rounded-lg border border-sky-800/30">
                                            <p className="text-[10px] font-bold text-sky-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Newspaper className="h-3 w-3" /> Recent News
                                            </p>
                                            <ul className="text-xs text-sky-300/80 space-y-1.5">
                                                {salesAssets.news_and_announcements.slice(0, 4).map((n, i) => (
                                                    <li key={i} className="flex gap-2"><span className="opacity-40">•</span>{n}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    );

                                case 'active_deals':
                                    if (salesAssets.active_deals.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-emerald-950/30 p-3 rounded-lg border border-emerald-800/30">
                                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Megaphone className="h-3 w-3" /> Active Promotions
                                            </p>
                                            <ul className="text-xs text-emerald-300/80 space-y-1">
                                                {salesAssets.active_deals.slice(0, 4).map((d, i) => <li key={i}>• {d}</li>)}
                                            </ul>
                                        </div>
                                    );

                                case 'locations':
                                    if (salesAssets.locations.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <MapPin className="h-3 w-3" /> Locations
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {salesAssets.locations.slice(0, 6).map((loc, i) => (
                                                    <span key={i} className="text-[10px] px-2 py-0.5 bg-card/50 border border-border/30 rounded-full text-muted-foreground">{loc}</span>
                                                ))}
                                            </div>
                                        </div>
                                    );

                                case 'software_stack':
                                    if (salesAssets.software_stack.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Briefcase className="h-3 w-3" /> Software Stack
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {salesAssets.software_stack.slice(0, 8).map((tool, i) => (
                                                    <span key={i} className="text-[10px] px-2 py-0.5 bg-card/50 border border-border/30 rounded-full text-muted-foreground">{tool}</span>
                                                ))}
                                            </div>
                                        </div>
                                    );

                                case 'employees':
                                    if (salesAssets.employees.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <User className="h-3 w-3" /> Employees Mentioned
                                            </p>
                                            <ul className="text-xs text-muted-foreground space-y-1">
                                                {salesAssets.employees.slice(0, 6).map((e, i) => (
                                                    <li key={i}>{e.name}{e.role ? ` — ${e.role}` : ''}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    );

                                case 'social_media':
                                    if (salesAssets.social_media_followings.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Megaphone className="h-3 w-3" /> Social Media
                                            </p>
                                            <ul className="text-xs text-muted-foreground space-y-1">
                                                {salesAssets.social_media_followings.slice(0, 5).map((item, i) => (
                                                    <li key={i}>{item.platform}{item.followers ? ` — ${item.followers}` : ''}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    );

                                case 'google_reviews':
                                    if (!salesAssets.google_reviews?.rating && !salesAssets.google_reviews?.review_count && (salesAssets.google_reviews?.highlights?.length ?? 0) === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-card p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Star className="h-3 w-3" /> Google Reviews
                                            </p>
                                            <div className="text-xs text-muted-foreground space-y-1">
                                                {salesAssets.google_reviews?.rating && (
                                                    <div>Rating: <span className="text-primary/90 font-medium">{salesAssets.google_reviews.rating}</span></div>
                                                )}
                                                {salesAssets.google_reviews?.review_count && (
                                                    <div>{salesAssets.google_reviews.review_count} reviews</div>
                                                )}
                                                {salesAssets.google_reviews?.highlights && salesAssets.google_reviews.highlights.length > 0 && (
                                                    <ul className="list-disc list-inside mt-1 space-y-1">
                                                        {salesAssets.google_reviews.highlights.slice(0, 3).map((h, i) => (
                                                            <li key={i} className="line-clamp-2">{h}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    );

                                case 'review_trends':
                                    if (salesAssets.google_reviews_analysis.length === 0) return null;
                                    return (
                                        <div key={field.id} className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                                            <p className="text-[10px] font-bold text-primary/90 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                                <Lightbulb className="h-3 w-3" /> Review Trends
                                            </p>
                                            <ul className="text-xs text-primary-foreground/70 space-y-1">
                                                {salesAssets.google_reviews_analysis.map((item, i) => (
                                                    <li key={i}>• {item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    );

                                default:
                                    return null;
                            }
                        })}
                    </div>
                )}

                {/* ── CONTEXT-AWARE CHAT ── */}
                {salesAssets && (
                    <div className="rounded-lg border border-border bg-card overflow-hidden">
                        <div className="px-3 py-2 border-b border-border bg-muted/60 flex items-center gap-2">
                            <MessageCircle className="h-3.5 w-3.5 text-primary" />
                            <span className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wide">Ask about this prospect</span>
                        </div>

                        {chatMessages.length > 0 && (
                            <div className="max-h-52 overflow-y-auto p-3 space-y-2.5">
                                {chatMessages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                                            msg.role === 'user'
                                                ? 'bg-primary text-primary-foreground font-medium rounded-br-sm'
                                                : 'bg-muted text-foreground rounded-bl-sm'
                                        }`}>
                                            {msg.content || (chatLoading && i === chatMessages.length - 1 ? (
                                                <span className="animate-pulse text-muted-foreground">...</span>
                                            ) : null)}
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
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        sendChatMessage()
                                    }
                                }}
                                placeholder="e.g. Draft an opening email for this company..."
                                rows={1}
                                className="flex-1 text-xs bg-muted border border-border text-foreground placeholder:text-muted-foreground rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                )}

                {/* Status / warning message */}
                {statusMessage && !analyzing && (
                    <p className="text-[10px] text-muted-foreground text-center pb-2">{statusMessage}</p>
                )}
            </div>

            {/* Analyze button */}
            <div className="action-footer">
                <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="primary-button w-full"
                >
                    <LayoutDashboard className="h-4 w-4" />
                    {analyzing ? statusMessage || 'Analyzing...' : 'Analyze Page'}
                </button>
            </div>
            {showCustomizeModal && (
                <CustomizeFieldsModal
                    fields={fieldConfigs}
                    onChange={handleSaveFields}
                    onClose={() => setShowCustomizeModal(false)}
                />
            )}
        </div>
    )
}
