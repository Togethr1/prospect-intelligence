import { useEffect, useState } from 'react'
import { Check, KeyRound, Link2, Loader2, ShieldCheck } from 'lucide-react'
import { hasPairing, redeemPairingCode } from '../services/local'

export function SettingsView() {
    const [code, setCode] = useState('')
    const [paired, setPaired] = useState(false)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')

    useEffect(() => { hasPairing().then(setPaired) }, [])

    const pair = async () => {
        if (!/^\d{6}$/.test(code)) return
        setBusy(true)
        setMessage('')
        try {
            await redeemPairingCode(code)
            setPaired(true)
            setCode('')
            setMessage('Extension paired with the local dashboard.')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Pairing failed.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="h-full overflow-auto bg-background p-4">
            <div className="mb-5">
                <h2 className="text-sm font-semibold">Local connection</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Pair this extension with your dashboard to retrieve CRM context. Provider credentials never enter the extension.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-xs font-medium">
                    {paired ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <Link2 className="h-4 w-4 text-primary" />}
                    {paired ? 'Paired' : 'Pair extension'}
                </div>
                {paired ? (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                        <Check className="h-3.5 w-3.5" /> Research access granted
                    </div>
                ) : (
                    <div className="mt-3 flex gap-2">
                        <div className="relative flex-1">
                            <KeyRound className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                                value={code}
                                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="6-digit code"
                                inputMode="numeric"
                                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 font-mono text-xs tracking-widest outline-none focus:border-primary"
                            />
                        </div>
                        <button onClick={pair} disabled={busy || code.length !== 6} className="rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Pair'}
                        </button>
                    </div>
                )}
                {message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}
            </div>
            <p className="mt-4 text-[10px] leading-4 text-muted-foreground">Generate a pairing code from Dashboard → Settings. Codes expire after five minutes.</p>
        </div>
    )
}
