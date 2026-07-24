import { BrainCircuit, ExternalLink } from 'lucide-react'
import type { AiSynthesisResult } from '@/integrations/types'

export function AiSynthesisView({ result }: { result: AiSynthesisResult }) {
    return (
        <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                        <BrainCircuit className="h-4 w-4 text-primary" />
                        {result.providerName} synthesis
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{result.model} · {result.costNotice}</p>
                </div>
                <span className="text-[11px] text-muted-foreground">{new Date(result.observedAt).toLocaleString()}</span>
            </div>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{result.content}</div>
            {result.citations.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                    <p className="text-xs font-medium">Sources returned by provider</p>
                    <div className="mt-2 space-y-1">
                        {result.citations.map((citation) => (
                            <a key={citation} href={citation} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                                <ExternalLink className="h-3 w-3" /> {citation}
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </section>
    )
}
