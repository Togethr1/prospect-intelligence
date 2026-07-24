'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Briefcase, MoreHorizontal, Pencil, PhoneCall, Trash2 } from 'lucide-react'
import { deletePersona } from '@/actions/personas'
import { Button } from '@/components/ui/button'
import type { Persona } from '@/types'

export function PersonaCard({
    persona,
    liveKitConnected,
}: {
    persona: Persona
    liveKitConnected: boolean
}) {
    const [menuOpen, setMenuOpen] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [isPending, startTransition] = useTransition()

    const remove = () => {
        startTransition(async () => {
            await deletePersona(persona.id)
            setConfirmingDelete(false)
        })
    }

    return (
        <article className="relative flex h-[240px] w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card p-4">
            <div className="min-h-0 flex-1 overflow-hidden">
                <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold">{persona.name}</h3>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Briefcase className="h-3 w-3 shrink-0" />
                            <span className="truncate">{persona.personality_config.jobTitle} · {persona.personality_config.industry}</span>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Manage ${persona.name}`}
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((current) => !current)}
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    {menuOpen && (
                        <div className="absolute right-4 top-14 z-20 w-36 rounded-lg border border-border bg-popover p-1 shadow-md">
                            <Link
                                href={`/roleplay/${persona.id}/edit`}
                                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                            >
                                <Pencil className="h-4 w-4" /> Edit
                            </Link>
                            <button
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                    setMenuOpen(false)
                                    setConfirmingDelete(true)
                                }}
                            >
                                <Trash2 className="h-4 w-4" /> Delete
                            </button>
                        </div>
                    )}
                </div>
                <div className="mt-3 min-w-0 space-y-1.5 overflow-hidden text-xs leading-5 text-muted-foreground">
                    <p className="line-clamp-1 break-words">
                        <span className="font-medium text-foreground/80">Likely objections: </span>
                        {persona.personality_config.keyObjections.join(', ')}
                    </p>
                    <p className="line-clamp-1 break-words">
                        <span className="font-medium text-foreground/80">Buying criteria: </span>
                        {persona.personality_config.buyingCriteria.join(', ')}
                    </p>
                    <p className="line-clamp-2 break-words">
                        <span className="font-medium text-foreground/80">Call scenario: </span>
                        {persona.personality_config.scenario || 'No call scenario added.'}
                    </p>
                </div>
            </div>

            {confirmingDelete ? (
                <div className="mt-4 shrink-0 rounded-lg bg-destructive/10 p-3">
                    <p className="whitespace-nowrap text-xs leading-5">
                        Delete {persona.name}? Saved transcripts stay on this device.
                    </p>
                    <div className="mt-3 flex gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            className="border border-white/80"
                            onClick={remove}
                            disabled={isPending}
                        >
                            {isPending ? 'Deleting…' : 'Delete'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)} disabled={isPending}>
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : liveKitConnected ? (
                <Link href={`/practice/${persona.id}`} className="mt-4 shrink-0">
                    <Button variant="outline" className="w-full hover:border-primary hover:bg-primary hover:text-white">
                        <PhoneCall className="h-4 w-4" /> Practice with {persona.name}
                    </Button>
                </Link>
            ) : (
                <Button
                    variant="outline"
                    className="mt-4 h-auto min-h-10 w-full shrink-0 cursor-not-allowed whitespace-normal border-border bg-muted/80 px-3 py-2 text-xs leading-4 text-foreground/70 disabled:bg-muted/80 disabled:text-foreground/70 disabled:opacity-100"
                    disabled
                >
                    Connect LiveKit API to Roleplay with {persona.name}
                </Button>
            )}
        </article>
    )
}
