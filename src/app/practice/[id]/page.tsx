export const dynamic = 'force-dynamic'

import { db } from "@/lib/local-db"
import { ChatInterface } from "@/components/simulation/chat-interface"
import { notFound } from "next/navigation"

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PracticeSessionPage({ params }: PageProps) {
    const { id } = await params
    const persona = db.getPersonaById(id)

    if (!persona) {
        return notFound()
    }

    return (
        <div className="container max-w-4xl mx-auto px-6 py-8">
            <div className="mb-6">
                <h1 className="text-xl font-semibold tracking-tight">Practice Session</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Simulating call with{' '}
                    <span className="text-foreground font-medium">{persona.name}</span>
                    {persona.personality_config.jobTitle && (
                        <span> — {persona.personality_config.jobTitle}</span>
                    )}
                </p>
            </div>

            <ChatInterface persona={persona} />
        </div>
    )
}
