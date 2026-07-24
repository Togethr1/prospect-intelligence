import { useEffect, useState } from 'react'
import { Check, ExternalLink, Link2, Loader2, ShieldCheck } from 'lucide-react'
import {
    checkExtensionApproval,
    hasPairing,
    requestExtensionApproval,
} from '../services/local'

export function SettingsView({ onPairingChange }: { onPairingChange?: (paired: boolean) => void }) {
    const [paired, setPaired] = useState(false)
    const [busy, setBusy] = useState(false)
    const [requestId, setRequestId] = useState('')
    const [message, setMessage] = useState('')

    useEffect(() => {
        hasPairing().then((value) => {
            setPaired(value)
            onPairingChange?.(value)
        })
    }, [onPairingChange])

    useEffect(() => {
        if (!requestId || paired) return
        let stopped = false
        const check = async () => {
            try {
                const approved = await checkExtensionApproval(requestId)
                if (!stopped && approved) {
                    setPaired(true)
                    onPairingChange?.(true)
                    setRequestId('')
                    setMessage('Connected. Local context is ready.')
                }
            } catch (error) {
                if (!stopped) {
                    setRequestId('')
                    setMessage(error instanceof Error ? error.message : 'Approval request expired.')
                }
            }
        }
        const timer = window.setInterval(check, 1_000)
        check()
        return () => {
            stopped = true
            window.clearInterval(timer)
        }
    }, [onPairingChange, paired, requestId])

    const requestAccess = async () => {
        setBusy(true)
        setMessage('')
        try {
            const request = await requestExtensionApproval()
            setRequestId(request.requestId)
            setMessage('Approve the pending request in Dashboard Settings.')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not reach the local dashboard.')
        } finally {
            setBusy(false)
        }
    }

    const openDashboard = () => chrome.tabs.create({ url: 'http://localhost:5178/settings' })

    return (
        <section className="w-[min(320px,calc(100vw-24px))] rounded-xl border border-border bg-elevated p-4 shadow-panel">
            <div className="flex items-start gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    paired ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                }`}>
                    {paired ? <ShieldCheck className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold">{paired ? 'Dashboard connected' : 'Connect local dashboard'}</h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {paired
                            ? 'Research and knowledge are available. Provider credentials remain in the dashboard.'
                            : 'Approve this extension once. No API keys are copied into Chrome.'}
                    </p>
                </div>
            </div>

            {paired ? (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-xs text-success" role="status">
                    <Check className="h-3.5 w-3.5" /> Secure local access active
                </div>
            ) : requestId ? (
                <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary" role="status">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for approval…
                    </div>
                    <button type="button" onClick={openDashboard} className="secondary-button w-full">
                        <ExternalLink className="h-3.5 w-3.5" /> Open Dashboard Settings
                    </button>
                </div>
            ) : (
                <button type="button" onClick={requestAccess} disabled={busy} className="primary-button mt-4 w-full">
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                    Request access
                </button>
            )}

            {message && <p className="mt-3 text-xs leading-5 text-muted-foreground" role="status">{message}</p>}
            <button type="button" onClick={openDashboard} className="mt-3 text-xs font-medium text-muted-foreground hover:text-foreground">
                Manage providers in Dashboard <ExternalLink className="ml-1 inline h-3 w-3" />
            </button>
        </section>
    )
}
