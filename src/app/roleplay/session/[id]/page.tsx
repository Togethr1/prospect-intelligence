export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { db } from '@/lib/local-db'
import { Button } from '@/components/ui/button'

export default async function SavedRoleplayPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = db.getRoleplaySessions().find((item) => item.id === id)
    if (!session) notFound()

    return (
        <div className="mx-auto max-w-3xl px-2 pb-16">
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        Saved call with {session.persona_name}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Stored locally · {new Date(session.updated_at).toLocaleString()}
                    </p>
                </div>
                <Link href="/roleplay"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
            </div>

            <div className="space-y-3">
                {session.transcript.map((message) => (
                    <div
                        key={message.id}
                        className={`max-w-[85%] rounded-xl border px-4 py-3 text-sm leading-6 ${
                            message.role === 'user'
                                ? 'ml-auto border-primary/30 bg-primary/10'
                                : 'border-border bg-card'
                        }`}
                    >
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {message.role === 'user' ? 'You' : session.persona_name}
                        </p>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}
