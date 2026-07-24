'use client'

import Link from 'next/link'
import { FormEvent, useMemo, useState } from 'react'
import { AlertTriangle, ArrowUp, BookOpen, Bot, KeyRound, RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Grid } from 'ldrs/react'
import 'ldrs/react/Grid.css'

interface Provider {
    id: string
    name: string
    note: string
}

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
}

const starters = [
    'Build a discovery-call plan for a skeptical VP of Sales.',
    'Turn my local knowledge into a concise cold-call opener.',
    'Help me prepare thoughtful questions for an account review.',
]

export function AssistantClient({ initialProviders }: { initialProviders: Provider[] }) {
    const [providerId, setProviderId] = useState(initialProviders[0]?.id || '')
    const [messages, setMessages] = useState<Message[]>([])
    const [draft, setDraft] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const provider = useMemo(() => initialProviders.find((item) => item.id === providerId), [initialProviders, providerId])

    const submit = async (event?: FormEvent, starter?: string) => {
        event?.preventDefault()
        const content = (starter || draft).trim()
        if (!content || !providerId || busy) return
        const nextMessages = [...messages, { id: crypto.randomUUID(), role: 'user' as const, content }]
        setMessages(nextMessages)
        setDraft('')
        setBusy(true)
        setError('')
        try {
            const response = await fetch('/api/assistant', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    providerId,
                    messages: nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
                }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'The assistant could not respond.')
            setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: data.content }])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'The assistant could not respond.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="grid min-h-[680px] gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="flex min-h-[680px] flex-col overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-primary" /> AI Assistant</h1>
                        <p className="mt-1 text-xs text-muted-foreground">Sales help grounded in the knowledge you save locally.</p>
                    </div>
                    {initialProviders.length > 0 && (
                        <select
                            value={providerId}
                            onChange={(event) => setProviderId(event.target.value)}
                            className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                            aria-label="AI provider"
                        >
                            {initialProviders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                    )}
                </div>

                <div className="flex flex-1 flex-col overflow-y-auto px-5 py-6">
                    {initialProviders.length === 0 ? (
                        <div className="m-auto max-w-md text-center">
                            <KeyRound className="mx-auto h-8 w-8 text-primary" />
                            <h2 className="mt-4 text-lg font-semibold">Connect an AI provider</h2>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">Add your own OpenAI, Claude, Gemini, Perplexity, or Grok key. Keys are encrypted on this device and never exposed to the browser after saving.</p>
                            <Link href="/settings"><Button className="mt-5">Open AI settings</Button></Link>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="m-auto w-full max-w-2xl">
                            <Bot className="h-8 w-8 text-primary" />
                            <h2 className="mt-4 text-2xl font-semibold tracking-tight">What are you working on?</h2>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">Ask for account prep, messaging, objection handling, or help using your local knowledge.</p>
                            <div className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border">
                                {starters.map((starter) => (
                                    <button key={starter} onClick={() => submit(undefined, starter)} className="block w-full bg-background/40 px-4 py-3 text-left text-sm transition hover:bg-white/5 hover:text-primary">
                                        {starter}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="mx-auto w-full max-w-3xl space-y-5">
                            {messages.map((message) => (
                                <div key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[85%]' : 'max-w-[92%]'}>
                                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{message.role === 'user' ? 'You' : provider?.name}</p>
                                    <div className={message.role === 'user'
                                        ? 'whitespace-pre-wrap rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground'
                                        : 'whitespace-pre-wrap text-sm leading-7 text-foreground/90'}>
                                        {message.content}
                                    </div>
                                </div>
                            ))}
                            {busy && (
                                <div className="flex items-center gap-4 text-sm text-muted-foreground" role="status" aria-live="polite">
                                    <Grid size="60" speed="1.5" color="var(--primary)" />
                                    <span>Thinking with {provider?.name}…</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {initialProviders.length > 0 && (
                    <div className="border-t border-border p-4">
                        {error && <div className="mb-3 flex items-center gap-2 text-xs text-destructive"><AlertTriangle className="h-4 w-4" /> {error}</div>}
                        <form onSubmit={(event) => submit(event)} className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-border bg-background p-2 focus-within:border-primary/60">
                            <textarea
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && !event.shiftKey) {
                                        event.preventDefault()
                                        submit()
                                    }
                                }}
                                placeholder="Ask your sales assistant…"
                                rows={2}
                                maxLength={4_000}
                                className="min-h-12 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
                            />
                            <Button size="icon" disabled={!draft.trim() || busy} aria-label="Send message"><ArrowUp className="h-4 w-4" /></Button>
                        </form>
                    </div>
                )}
            </section>

            <aside className="space-y-5">
                <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Active provider</p>
                    <p className="mt-3 font-medium">{provider?.name || 'None connected'}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{provider?.note || 'Connect a provider in Settings to begin.'}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <p className="flex items-center gap-2 text-sm font-medium"><BookOpen className="h-4 w-4 text-primary" /> Local context</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">Up to 20 locally saved knowledge items are supplied with each request. They remain on this machine except for the excerpts sent to your selected AI provider.</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="text-sm font-medium text-amber-300">Provider charges may apply</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">Each message is an explicit request to your connected provider and may consume its quota or incur charges.</p>
                </div>
                {messages.length > 0 && (
                    <Button variant="outline" className="w-full" onClick={() => { setMessages([]); setError('') }}>
                        <RotateCcw className="h-4 w-4" /> New conversation
                    </Button>
                )}
            </aside>
        </div>
    )
}
