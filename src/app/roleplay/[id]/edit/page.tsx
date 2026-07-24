import { notFound } from 'next/navigation'
import { PersonaForm } from '@/components/personas/persona-form'
import { db } from '@/lib/local-db'

export const dynamic = 'force-dynamic'

export default async function EditPersonaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const persona = db.getPersonaById(id)
    if (!persona) notFound()

    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
            <div className="mb-6">
                <h1 className="text-xl font-semibold tracking-tight">Edit prospect</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Update the roleplay context, behavior, and voice for {persona.name}.
                </p>
            </div>
            <PersonaForm persona={persona} />
        </div>
    )
}
