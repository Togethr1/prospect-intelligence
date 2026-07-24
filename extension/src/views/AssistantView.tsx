import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowUp, Bot, ExternalLink, Sparkles, User } from 'lucide-react'
import { Grid } from 'ldrs/react'
import 'ldrs/react/Grid.css'
import {
    listAiProviders,
    sendAssistantMessage,
    type AssistantMessage,
    type IntelligenceProvider,
} from '../services/local'

const prompts = [
    'Draft a concise cold-call opener.',
    'Help me handle a pricing objection.',
    'Summarize the latest saved prospect.',
]

export function AssistantView({ paired, onOpenConnection }: { paired: boolean; onOpenConnection: () => void }) {
    const [providers, setProviders] = useState<IntelligenceProvider[]>([])
    const [providerId, setProviderId] = useState('')
    const [messages, setMessages] = useState<AssistantMessage[]>([])
    const [draft, setDraft] = useState('')
    const [loading, setLoading] = useState(false)
    const [providersLoaded, setProvidersLoaded] = useState(false)
    const [error, setError] = useState('')
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        listAiProviders()
            .then((items) => {
                setProviders(items)
                setProviderId((current) => current || items[0]?.id || '')
                setProvidersLoaded(true)
            })
            .catch((err) => {
                setProvidersLoaded(true)
                setError(err instanceof Error && err.message === 'PAIRING_REQUIRED'
                    ? 'Connect the extension to use your dashboard providers.'
                    : err instanceof Error ? err.message : 'Could not load AI providers.')
            })
    }, [])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    const submit = async (event?: FormEvent, suggestion?: string) => {
        event?.preventDefault()
        const content = (suggestion || draft).trim()
        if (!content || loading || !providerId) return
        const next = [...messages, { role: 'user' as const, content }]
        setMessages(next)
        setDraft('')
        setError('')
        setLoading(true)
        try {
            const response = await sendAssistantMessage(providerId, next)
            setMessages([...next, { role: 'assistant', content: response.content }])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'The assistant could not respond.')
        } finally {
            setLoading(false)
        }
    }

    const noProvider = providersLoaded && providers.length === 0

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            <header className="view-header">
                <div>
                    <h2>Sales Assistant</h2>
                    <p>Grounded in saved research, knowledge, and personas.</p>
                </div>
                {providers.length > 1 && (
                    <select
                        value={providerId}
                        onChange={(event) => setProviderId(event.target.value)}
                        className="provider-select"
                        aria-label="AI provider"
                    >
                        {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                    </select>
                )}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {messages.length === 0 && (
                    <div className="mx-auto flex max-w-sm flex-col items-center pt-8 text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Sparkles className="h-5 w-5" />
                        </span>
                        <h3 className="mt-3 text-sm font-semibold">What do you need before the call?</h3>
                        <p className="mt-1 max-w-[34ch] text-xs leading-5 text-muted-foreground">
                            Ask about messaging, accounts, objections, personas, or anything saved in the dashboard.
                        </p>
                        <div className="mt-5 grid w-full gap-2">
                            {prompts.map((prompt) => (
                                <button
                                    key={prompt}
                                    type="button"
                                    onClick={() => submit(undefined, prompt)}
                                    disabled={noProvider || !paired}
                                    className="prompt-button"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    {messages.map((message, index) => (
                        <div key={`${message.role}-${index}`} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
                            {message.role === 'assistant' && <span className="message-avatar"><Bot className="h-3.5 w-3.5" /></span>}
                            <div className={message.role === 'user' ? 'message-user' : 'message-assistant'}>
                                {message.content}
                            </div>
                            {message.role === 'user' && <span className="message-avatar"><User className="h-3.5 w-3.5" /></span>}
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-2">
                            <span className="message-avatar"><Bot className="h-3.5 w-3.5" /></span>
                            <div className="message-assistant flex items-center gap-2 text-muted-foreground" aria-label="Assistant is thinking">
                                <Grid size="24" speed="1.5" color="var(--primary)" />
                                <span>Thinking…</span>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {error && (
                    <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs leading-5 text-destructive" role="alert">
                        {error}
                        {error.toLowerCase().includes('connect') && (
                            <button type="button" onClick={onOpenConnection} className="mt-2 flex items-center gap-1 font-semibold underline">
                                Open connection <ExternalLink className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                )}

                {noProvider && paired && !error && (
                    <div className="provider-lock mt-4" role="alert">
                        <div>
                            <strong>Assistant locked</strong>
                            <p>Connect an AI provider in Dashboard Settings to use the assistant.</p>
                        </div>
                        <a href="http://localhost:5178/settings" target="_blank" rel="noreferrer">
                            Open Dashboard Settings <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                )}
            </div>

            <form onSubmit={submit} className="composer">
                <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            submit()
                        }
                    }}
                    placeholder={noProvider ? 'Connect an AI provider first' : 'Ask your sales assistant…'}
                    rows={1}
                    disabled={noProvider || !paired}
                />
                <button type="submit" disabled={!draft.trim() || loading || noProvider || !paired} aria-label="Send">
                    <ArrowUp className="h-4 w-4" />
                </button>
                <p>Uses {providers.find((provider) => provider.id === providerId)?.name || 'your selected provider'} and may incur provider charges.</p>
            </form>
        </div>
    )
}
