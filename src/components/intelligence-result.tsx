import { Building2, ExternalLink, Mail, Phone, Users } from 'lucide-react'
import type { IntelligenceResult } from '@/integrations/types'

export function IntelligenceResultView({ result }: { result: IntelligenceResult }) {
    return (
        <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                        <Building2 className="h-4 w-4 text-primary" />
                        {result.providerName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{result.costNotice}</p>
                </div>
                <span className="text-[11px] text-muted-foreground">
                    {new Date(result.observedAt).toLocaleString()}
                </span>
            </div>

            {result.company ? (
                <div className="mt-4 border-t border-border pt-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="font-medium">{result.company.name || result.domain}</h3>
                        {result.company.industry && <span className="text-xs text-muted-foreground">{result.company.industry}</span>}
                    </div>
                    {result.company.description && <p className="mt-2 text-xs leading-5 text-muted-foreground">{result.company.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {result.company.employeeCount !== undefined && (
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {result.company.employeeCount.toLocaleString()} employees</span>
                        )}
                        {result.company.annualRevenue && <span>{result.company.annualRevenue} revenue</span>}
                        {[result.company.city, result.company.state, result.company.country].filter(Boolean).length > 0 && (
                            <span>{[result.company.city, result.company.state, result.company.country].filter(Boolean).join(', ')}</span>
                        )}
                        {result.company.linkedinUrl && (
                            <a className="flex items-center gap-1 text-primary hover:underline" href={result.company.linkedinUrl} target="_blank" rel="noreferrer">
                                LinkedIn <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                    </div>
                </div>
            ) : (
                <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
                    No exact-domain company match returned.
                </p>
            )}

            <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-medium">{result.contacts.length ? `${result.contacts.length} contacts` : 'No contacts returned'}</p>
                {result.contacts.length > 0 && (
                    <div className="mt-3 divide-y divide-border">
                        {result.contacts.map((contact) => (
                            <div key={contact.id} className="py-3 first:pt-0 last:pb-0">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <p className="text-sm font-medium">{contact.name}</p>
                                    {contact.confidence !== undefined && <span className="text-[11px] text-muted-foreground">{contact.confidence}% confidence</span>}
                                </div>
                                {contact.title && <p className="mt-0.5 text-xs text-muted-foreground">{contact.title}</p>}
                                <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
                                    {contact.email && <a className="flex items-center gap-1 text-primary hover:underline" href={`mailto:${contact.email}`}><Mail className="h-3 w-3" /> {contact.email}</a>}
                                    {contact.phone && <a className="flex items-center gap-1 text-primary hover:underline" href={`tel:${contact.phone}`}><Phone className="h-3 w-3" /> {contact.phone}</a>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}
