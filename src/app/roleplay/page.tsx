import { getPersonas } from "@/actions/personas";
import Link from "next/link";
import { ArrowRight, History, Plus, ShieldCheck, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Persona } from "@/types";
import { db } from "@/lib/local-db";
import { PersonaCard } from "@/components/personas/persona-card";
import { listIntegrationSummaries } from "@/integrations/credential-broker";

export default async function RoleplayPage() {
    const personas: Persona[] = await getPersonas()
    const recentSessions = db.getRoleplaySessions().slice(0, 8)
    let liveKitConnected = false
    try {
        liveKitConnected = listIntegrationSummaries().some(
            (integration) => integration.id === 'livekit' && integration.status === 'connected',
        )
    } catch {
        liveKitConnected = false
    }

    return (
        <div className="mx-auto w-full max-w-5xl px-2">
                <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Role Play</h1>
                        <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                            Choose a prospect and practice your pitch against their role, priorities, and objections.
                        </p>
                    </div>
                    <Link href="/roleplay/new">
                        <Button className="h-10 px-5">
                            <Plus className="h-4 w-4" />
                            New Persona
                        </Button>
                    </Link>
                </div>

                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
                    <section className="min-w-0">
                        <div className="mb-3 flex items-baseline gap-2">
                            <h2 className="text-sm font-semibold">Practice prospects</h2>
                            <span className="text-xs text-muted-foreground">
                                {personas.length} {personas.length === 1 ? 'persona' : 'personas'}
                            </span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {personas.map((persona) => (
                                <PersonaCard
                                    key={persona.id}
                                    persona={persona}
                                    liveKitConnected={liveKitConnected}
                                />
                            ))}

                            {personas.length === 0 && (
                                <div className="col-span-full flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/45 px-6 py-10">
                                    <p className="mb-1 text-sm font-medium">No personas yet</p>
                                    <p className="max-w-sm text-center text-xs leading-5 text-muted-foreground">
                                        Use the orange New Persona button above to create your first practice prospect.
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className="flex h-[240px] flex-col overflow-hidden rounded-xl border border-border bg-card lg:mt-8">
                        <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
                            <History className="h-4 w-4 text-primary" />
                            <h2 className="text-sm font-semibold">Recent practice</h2>
                        </div>
                        {recentSessions.length > 0 ? (
                            <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                            {recentSessions.map((session) => (
                                <Link
                                    key={session.id}
                                    href={`/roleplay/session/${session.id}`}
                                    className="group flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">{session.persona_name}</p>
                                        <p className="mt-1 truncate text-xs text-muted-foreground">
                                            {session.transcript.length} messages · {new Date(session.updated_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                                </Link>
                            ))}
                            </div>
                        ) : (
                            <div className="min-h-0 flex-1 px-4 py-5">
                                <p className="text-sm font-medium">Your calls will appear here</p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    Start a session with any prospect. Transcripts stay on this device for review.
                                </p>
                            </div>
                        )}
                        <div className="mt-auto shrink-0 space-y-3 border-t border-border bg-background/25 px-4 py-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Volume2 className="h-4 w-4 text-primary" />
                                Live voice roleplay
                            </div>
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                                Local transcript history
                            </div>
                        </div>
                    </aside>
                </div>
        </div>
    );
}
