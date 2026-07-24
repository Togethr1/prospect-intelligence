'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    AlertTriangle, BrainCircuit, Check, Copy, Database, KeyRound,
    Link2, Loader2, PlugZap, RefreshCw, ShieldCheck, Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { IntegrationCategory, IntegrationSummary } from '@/integrations/types'

const categories: Array<{ id: IntegrationCategory; label: string; icon: typeof Database }> = [
    { id: 'crm', label: 'CRM', icon: Database },
    { id: 'sales-intelligence', label: 'Sales intelligence', icon: PlugZap },
    { id: 'ai', label: 'AI providers', icon: BrainCircuit },
]

export function SettingsClient({ initialIntegrations }: { initialIntegrations: IntegrationSummary[] }) {
    const [integrations, setIntegrations] = useState<IntegrationSummary[]>(initialIntegrations)
    const [activeCategory, setActiveCategory] = useState<IntegrationCategory>('crm')
    const [credentialDrafts, setCredentialDrafts] = useState<Record<string, string>>({})
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null)

    const load = useCallback(async () => {
        setError('')
        const response = await fetch('/api/integrations', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load integrations.')
        setIntegrations(data.integrations)
    }, [])

    useEffect(() => { load().catch((err) => setError(err.message)) }, [load])

    const visible = useMemo(
        () => integrations.filter((integration) => integration.category === activeCategory),
        [activeCategory, integrations],
    )

    const connect = async (providerId: string) => {
        const credential = credentialDrafts[providerId]?.trim()
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

    const createPairing = async () => {
        setBusy('pairing')
        setError('')
        try {
            const response = await fetch('/api/pairing', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'create' }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Could not create pairing code.')
            setPairing(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not create pairing code.')
        } finally {
            setBusy(null)
        }
    }

    return (
        <div className="mx-auto max-w-5xl px-2 pb-16">
            <div className="mb-8 grid gap-6 border-b border-border pb-7 md:grid-cols-[1fr_280px]">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Connections</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Bring your existing CRM, intelligence, and AI accounts. Credentials remain in server memory for this session and are never sent to the extension.
                    </p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                        <ShieldCheck className="h-4 w-4" /> Safe defaults active
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">No provider can run until you connect it. Planned credit-consuming adapters remain disabled.</p>
                </div>
            </div>

            {error && (
                <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
            )}

            <section className="mb-10">
                <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-semibold">Chrome extension pairing</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Pairing grants research access only. It never grants access to credentials or settings.</p>
                    </div>
                    <Button variant="outline" onClick={createPairing} disabled={busy === 'pairing'}>
                        {busy === 'pairing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                        Generate code
                    </Button>
                </div>
                {pairing && (
                    <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                        <div>
                            <p className="font-mono text-2xl font-semibold tracking-[0.25em] text-primary">{pairing.code}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Valid for five minutes. Enter it in the extension.</p>
                        </div>
                        <button
                            className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                            onClick={() => navigator.clipboard.writeText(pairing.code)}
                            aria-label="Copy pairing code"
                        >
                            <Copy className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </section>

            <div className="mb-6 flex gap-1 rounded-xl border border-border bg-card p-1">
                {categories.map((category) => {
                    const Icon = category.icon
                    return (
                        <button
                            key={category.id}
                            onClick={() => setActiveCategory(category.id)}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm transition ${
                                activeCategory === category.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                            }`}
                        >
                            <Icon className="h-4 w-4" /> {category.label}
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
                                        <span className="flex items-center gap-1 text-xs text-emerald-400"><Check className="h-3 w-3" /> Connected</span>
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

                            {integration.available && integration.status === 'disconnected' && (
                                <div className="flex w-full shrink-0 gap-2 md:w-[360px]">
                                    <div className="relative flex-1">
                                        <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="password"
                                            autoComplete="off"
                                            value={credentialDrafts[integration.id] || ''}
                                            onChange={(event) => setCredentialDrafts((current) => ({ ...current, [integration.id]: event.target.value }))}
                                            placeholder={integration.credentialLabel}
                                            className="pl-9"
                                        />
                                    </div>
                                    <Button onClick={() => connect(integration.id)} disabled={busy === integration.id || !credentialDrafts[integration.id]?.trim()}>
                                        {busy === integration.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
                                    </Button>
                                </div>
                            )}

                            {integration.status === 'connected' && (
                                <div className="flex shrink-0 items-center gap-3">
                                    <div className="text-right">
                                        <p className="font-mono text-xs text-muted-foreground">SHA-256 …{integration.fingerprint}</p>
                                        <p className="mt-1 text-[10px] text-muted-foreground">Session memory only</p>
                                    </div>
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
    )
}
