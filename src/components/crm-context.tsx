import { BriefcaseBusiness, Building2, ExternalLink, Mail, UserRound } from 'lucide-react'
import type { CrmAccountContext } from '@/integrations/types'

export function CrmContext({ context }: { context: CrmAccountContext & { disconnected?: boolean } }) {
    if (context.disconnected) {
        return (
            <div className="rounded-xl border border-dashed border-border p-4">
                <div className="flex items-center gap-2 text-sm font-medium"><Building2 className="h-4 w-4 text-primary" /> CRM context</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Connect HubSpot in Settings to match this website with accounts, contacts, and open deals.</p>
            </div>
        )
    }
    if (context.match === 'none' || !context.account) {
        return (
            <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm font-medium"><Building2 className="h-4 w-4 text-primary" /> No CRM match</div>
                <p className="mt-2 text-xs text-muted-foreground">No exact HubSpot company-domain match was returned.</p>
            </div>
        )
    }

    return (
        <section className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">CRM account · HubSpot</p>
                    <h3 className="mt-1 text-lg font-semibold">{context.account.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {[context.account.industry, context.account.city, context.account.state, context.account.country].filter(Boolean).join(' · ') || context.account.domain}
                    </p>
                </div>
                {context.account.sourceUrl && (
                    <a href={context.account.sourceUrl} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label="Open CRM account">
                        <ExternalLink className="h-4 w-4" />
                    </a>
                )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/70 bg-card p-3">
                    <div className="flex items-center gap-2 text-xs font-medium"><UserRound className="h-3.5 w-3.5 text-primary" /> Contacts</div>
                    <div className="mt-2 space-y-2">
                        {context.contacts.length ? context.contacts.slice(0, 5).map((contact) => (
                            <div key={contact.id} className="text-xs">
                                <p className="font-medium">{contact.name}</p>
                                <p className="text-muted-foreground">{contact.title || 'Title unavailable'}</p>
                                {contact.email && <p className="mt-0.5 flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /> {contact.email}</p>}
                            </div>
                        )) : <p className="text-xs text-muted-foreground">No associated contacts returned.</p>}
                    </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-card p-3">
                    <div className="flex items-center gap-2 text-xs font-medium"><BriefcaseBusiness className="h-3.5 w-3.5 text-primary" /> Opportunities</div>
                    <div className="mt-2 space-y-2">
                        {context.opportunities.length ? context.opportunities.slice(0, 5).map((deal) => (
                            <div key={deal.id} className="text-xs">
                                <p className="font-medium">{deal.name}</p>
                                <p className="text-muted-foreground">{[deal.stage, deal.amount].filter(Boolean).join(' · ') || 'Stage unavailable'}</p>
                            </div>
                        )) : <p className="text-xs text-muted-foreground">No associated open deals returned.</p>}
                    </div>
                </div>
            </div>
        </section>
    )
}
