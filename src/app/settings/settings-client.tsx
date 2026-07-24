'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    AlertTriangle, BrainCircuit, Check, Database, KeyRound, Radio, Star,
    Link2, Loader2, PlugZap, Plus, RefreshCw, ShieldCheck, Trash2, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { IntegrationCategory, IntegrationSummary } from '@/integrations/types'

const categories: Array<{ id: IntegrationCategory; label: string; icon: typeof Database }> = [
    { id: 'voice', label: 'Voice', icon: Radio },
    { id: 'crm', label: 'CRM', icon: Database },
    { id: 'sales-intelligence', label: 'Sales intelligence', icon: PlugZap },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'ai', label: 'AI providers', icon: BrainCircuit },
]

interface ExtensionPairingState {
    pending: Array<{ id: string; extensionId: string; createdAt: string; expiresAt: string }>
    approved: Array<{ id: string; extensionId: string; createdAt: string }>
}

export function SettingsClient({ initialIntegrations }: { initialIntegrations: IntegrationSummary[] }) {
    const [integrations, setIntegrations] = useState<IntegrationSummary[]>(initialIntegrations)
    const [activeCategory, setActiveCategory] = useState<IntegrationCategory>('voice')
    const [credentialDrafts, setCredentialDrafts] = useState<Record<string, string>>({})
    const [liveKitDraft, setLiveKitDraft] = useState({ url: '', apiKey: '', apiSecret: '' })
    const [busy, setBusy] = useState<string | null>(null)
    const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
    const [savedProvider, setSavedProvider] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [pairing, setPairing] = useState<ExtensionPairingState>({ pending: [], approved: [] })

    const load = useCallback(async () => {
        setError('')
        const response = await fetch('/api/integrations', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load integrations.')
        setIntegrations(data.integrations)
    }, [])

    useEffect(() => { load().catch((err) => setError(err.message)) }, [load])

    const loadPairing = useCallback(async () => {
        const response = await fetch('/api/pairing', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load extension approvals.')
        setPairing(data)
    }, [])

    useEffect(() => {
        loadPairing().catch((err) => setError(err.message))
        const timer = window.setInterval(() => {
            loadPairing().catch(() => undefined)
        }, 2_000)
        return () => window.clearInterval(timer)
    }, [loadPairing])

    const visible = useMemo(
        () => integrations.filter((integration) => integration.category === activeCategory),
        [activeCategory, integrations],
    )

    const connect = async (providerId: string) => {
        const credential = providerId === 'livekit'
            ? JSON.stringify(liveKitDraft)
            : credentialDrafts[providerId]?.trim()
        if (!credential) return
        setBusy(providerId)
        setError('')
        try {
            const response = await fetch('/api/integrations', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ providerId, credential }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Connection failed.')
            setIntegrations(data.integrations)
            setCredentialDrafts((current) => ({ ...current, [providerId]: '' }))
            if (providerId === 'livekit') setLiveKitDraft({ url: '', apiKey: '', apiSecret: '' })
            setExpandedProvider(null)
            setSavedProvider(providerId)
            window.setTimeout(() => {
                setSavedProvider((current) => current === providerId ? null : current)
            }, 1_800)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Connection failed.')
        } finally {
            setBusy(null)
        }
    }

    const disconnect = async (providerId: string) => {
        setBusy(providerId)
        setError('')
        try {
            const response = await fetch('/api/integrations', {
                method: 'DELETE',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ providerId }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Disconnect failed.')
            setIntegrations(data.integrations)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Disconnect failed.')
        } finally {
            setBusy(null)
        }
    }

    const updatePairing = async (action: 'approve' | 'revoke', value: string) => {
        setBusy(`pairing-${value}`)
        setError('')
        try {
            const response = await fetch('/api/pairing', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(action === 'approve'
                    ? { action, requestId: value }
                    : { action, id: value }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Could not update extension access.')
            await loadPairing()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not update extension access.')
        } finally {
            setBusy(null)
        }
    }

    return (
        <div className="pb-16">
            <div className="mb-8 flex flex-col gap-4 border-b border-border pb-7 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Connect voice, CRM, intelligence, review, and AI accounts. Nothing runs until you explicitly connect and use it.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Keys encrypted on this device</span>
                    <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-400" /> Explicit requests only</span>
                </div>
            </div>

            {error && (
                <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
            )}

            <div className="grid items-start gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="space-y-5 lg:sticky lg:top-6">
            <section className="rounded-xl border border-border bg-card p-4">
                <div className="mb-4">
                    <h3 className="text-sm font-semibold">Chrome extension access</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Request access from the extension, then approve it here. Approval grants local research access only—never credentials or settings.
                    </p>
                </div>

                {pairing.pending.length === 0 && pairing.approved.length === 0 && (
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/50 px-3 py-3 text-xs text-muted-foreground">
                        <Link2 className="h-4 w-4 shrink-0" />
                        No extension has requested access yet.
                    </div>
                )}

                <div className="space-y-2">
                    {pairing.pending.map((request) => (
                        <div key={request.id} className="flex flex-col justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center">
                            <div className="min-w-0">
                                <p className="flex items-center gap-2 text-sm font-medium">
                                    <span className="h-2 w-2 rounded-full bg-primary" />
                                    Extension requesting access
                                </p>
                                <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={request.extensionId}>
                                    Chrome ID · {request.extensionId}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                onClick={() => updatePairing('approve', request.id)}
                                disabled={busy === `pairing-${request.id}`}
                            >
                                {busy === `pairing-${request.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Approve
                            </Button>
                        </div>
                    ))}

                    {pairing.approved.map((device) => (
                        <div key={device.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                            <div className="min-w-0">
                                <p className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                                    <ShieldCheck className="h-4 w-4" /> Approved extension
                                </p>
                                <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={device.extensionId}>
                                    Chrome ID · {device.extensionId}
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => updatePairing('revoke', device.id)}
                                disabled={busy === `pairing-${device.id}`}
                                aria-label={`Revoke extension ${device.extensionId}`}
                            >
                                {busy === `pairing-${device.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                        </div>
                    ))}
                </div>
            </section>

            <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold">Credential boundaries</h3>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                    <li>Credentials persist locally using AES-256-GCM encryption and a device-only key.</li>
                    <li>The extension receives research results, never provider credentials.</li>
                    <li>Disconnecting removes a credential immediately.</li>
                </ul>
            </div>
            </aside>

            <div className="min-w-0">
            <div className="mb-6 flex gap-1 rounded-xl border border-border bg-card p-1">
                {categories.map((category) => {
                    const Icon = category.icon
                    return (
                        <button
                            key={category.id}
                            onClick={() => {
                                setActiveCategory(category.id)
                                setExpandedProvider(null)
                            }}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm transition ${
                                activeCategory === category.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                            }`}
                        >
                            <Icon className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">{category.label}</span>
                        </button>
                    )
                })}
            </div>

            <div className="space-y-3">
                {visible.map((integration) => (
                    <div key={integration.id} className="rounded-xl border border-border bg-card p-5">
                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-semibold">{integration.name}</h3>
                                    {integration.status === 'connected' ? (
                                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                                            <Check className="h-3 w-3" />
                                            {integration.available ? 'Connected' : 'Credential saved'}
                                        </span>
                                    ) : !integration.available ? (
                                        <span className="text-xs text-muted-foreground">Planned</span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">Disconnected</span>
                                    )}
                                    <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{integration.cost}</span>
                                </div>
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">{integration.note}</p>
                                <p className="mt-2 text-xs text-foreground/70">{integration.capabilities.join(' · ')}</p>
                            </div>

                            {(integration.available || integration.credentialConfigurable) && integration.status === 'disconnected' && (
                                <div className="flex w-full shrink-0 justify-end md:w-auto">
                                    <div
                                        id={`credential-${integration.id}`}
                                        className={`credential-reveal ${expandedProvider === integration.id ? 'credential-reveal--open' : ''}`}
                                        aria-hidden={expandedProvider !== integration.id}
                                    >
                                        <div className={`flex w-[min(100%,520px)] gap-2 ${integration.id === 'livekit' ? 'flex-col' : ''}`}>
                                            {integration.id === 'livekit' ? (
                                                <div className="grid gap-2 sm:grid-cols-3">
                                                    <Input
                                                        type="url"
                                                        autoComplete="off"
                                                        value={liveKitDraft.url}
                                                        onChange={(event) => setLiveKitDraft((current) => ({ ...current, url: event.target.value }))}
                                                        placeholder="wss://project.livekit.cloud"
                                                        aria-label="LiveKit Project URL"
                                                        tabIndex={expandedProvider === integration.id ? 0 : -1}
                                                    />
                                                    <Input
                                                        type="password"
                                                        autoComplete="off"
                                                        value={liveKitDraft.apiKey}
                                                        onChange={(event) => setLiveKitDraft((current) => ({ ...current, apiKey: event.target.value }))}
                                                        placeholder="API key"
                                                        aria-label="LiveKit API key"
                                                        tabIndex={expandedProvider === integration.id ? 0 : -1}
                                                    />
                                                    <Input
                                                        type="password"
                                                        autoComplete="off"
                                                        value={liveKitDraft.apiSecret}
                                                        onChange={(event) => setLiveKitDraft((current) => ({ ...current, apiSecret: event.target.value }))}
                                                        placeholder="API secret"
                                                        aria-label="LiveKit API secret"
                                                        tabIndex={expandedProvider === integration.id ? 0 : -1}
                                                    />
                                                </div>
                                            ) : (
                                            <div className="relative min-w-0 flex-1">
                                                <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="password"
                                                    autoComplete="off"
                                                    value={credentialDrafts[integration.id] || ''}
                                                    onChange={(event) => setCredentialDrafts((current) => ({ ...current, [integration.id]: event.target.value }))}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Escape') setExpandedProvider(null)
                                                        if (event.key === 'Enter' && credentialDrafts[integration.id]?.trim()) connect(integration.id)
                                                    }}
                                                    placeholder={integration.credentialLabel}
                                                    className="pl-9"
                                                    tabIndex={expandedProvider === integration.id ? 0 : -1}
                                                    ref={(node) => {
                                                        if (expandedProvider === integration.id && node) node.focus()
                                                    }}
                                                />
                                            </div>
                                            )}
                                            <Button
                                                onClick={() => connect(integration.id)}
                                                disabled={busy === integration.id || (integration.id === 'livekit'
                                                    ? !liveKitDraft.url.trim() || !liveKitDraft.apiKey.trim() || !liveKitDraft.apiSecret.trim()
                                                    : !credentialDrafts[integration.id]?.trim())}
                                                tabIndex={expandedProvider === integration.id ? 0 : -1}
                                                className="disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                                            >
                                                {busy === integration.id ? <Loader2 className="h-4 w-4 animate-spin" /> : integration.id === 'livekit' ? 'Test & connect' : 'Save'}
                                            </Button>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setExpandedProvider((current) => current === integration.id ? null : integration.id)}
                                        aria-expanded={expandedProvider === integration.id}
                                        aria-controls={`credential-${integration.id}`}
                                        aria-label={expandedProvider === integration.id ? `Cancel connecting ${integration.name}` : `Connect ${integration.name}`}
                                        className={`credential-trigger ${expandedProvider === integration.id ? 'credential-trigger--open' : ''}`}
                                    >
                                        {expandedProvider === integration.id ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                    </button>
                                </div>
                            )}

                            {integration.status === 'connected' && (
                                <div className="flex shrink-0 items-center gap-3">
                                    {savedProvider === integration.id ? (
                                        <div className="credential-saved" role="status" aria-live="polite">
                                            <span className="credential-saved__icon"><Check className="h-3.5 w-3.5" /></span>
                                            <span>Saved securely</span>
                                        </div>
                                    ) : (
                                        <div className="text-right">
                                            <p className="font-mono text-xs text-muted-foreground">SHA-256 …{integration.fingerprint}</p>
                                            <p className="mt-1 text-[10px] text-muted-foreground">Encrypted on this device</p>
                                        </div>
                                    )}
                                    <Button variant="outline" size="icon" onClick={() => disconnect(integration.id)} disabled={busy === integration.id} aria-label={`Disconnect ${integration.name}`}>
                                        {busy === integration.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            </div>
            </div>
        </div>
    )
}
