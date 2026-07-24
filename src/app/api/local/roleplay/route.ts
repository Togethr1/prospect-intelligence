import { NextResponse } from 'next/server'
import { db } from '@/lib/local-db'
import { assertDashboardRequest, cleanText, publicError, readJsonObject, SafeRequestError } from '@/lib/security'

export async function POST(request: Request) {
    try {
        const body = await readJsonObject(request)
        assertDashboardRequest(request)
        const sessionId = cleanText(body.sessionId, 100) || undefined
        const personaId = cleanText(body.personaId, 100)
        const personaName = cleanText(body.personaName, 200)
        const rawMessages = Array.isArray(body.messages) ? body.messages.slice(0, 50) : []
        if (!personaId || !personaName || !rawMessages.length) throw new SafeRequestError('Persona and transcript are required.')
        const transcript = rawMessages.map((raw, index) => {
            const message = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
            const role = message.role === 'assistant' ? 'assistant' as const : 'user' as const
            const content = cleanText(message.content, 4_000)
            if (!content) throw new SafeRequestError('Transcript messages cannot be empty.')
            return {
                id: cleanText(message.id, 100) || `${Date.now()}-${index}`,
                role,
                content,
                timestamp: cleanText(message.timestamp, 100) || new Date().toISOString(),
            }
        })
        return NextResponse.json(db.saveRoleplaySession(sessionId, { id: personaId, name: personaName }, transcript))
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await readJsonObject(request)
        assertDashboardRequest(request)
        const id = cleanText(body.id, 100)
        if (!id) throw new SafeRequestError('Session ID is required.')
        db.deleteRoleplaySession(id)
        return NextResponse.json({ deleted: true })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
