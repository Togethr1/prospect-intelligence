import { NextResponse } from 'next/server'
import { LIMITS, cleanText, publicError, readJsonObject } from '@/lib/security'
import { localProspectReply } from '@/lib/local-analysis'

export async function POST(request: Request) {
    try {
        const body = await readJsonObject(request)
        const messages = Array.isArray(body.messages) ? body.messages.slice(-LIMITS.messages) : []
        const persona = body.persona && typeof body.persona === 'object' ? body.persona as Record<string, unknown> : {}
        const config = persona.personality_config && typeof persona.personality_config === 'object'
            ? persona.personality_config as Record<string, unknown>
            : {}
        const last = [...messages].reverse().find((item) => item && typeof item === 'object' && (item as { role?: unknown }).role === 'user')
        const content = cleanText((last as { content?: unknown } | undefined)?.content, LIMITS.messageChars)
        if (!content) return NextResponse.json({ error: 'A user message is required.' }, { status: 400 })
        const objections = Array.isArray(config.keyObjections)
            ? config.keyObjections.map((item) => cleanText(item, 300)).filter(Boolean).slice(0, 10)
            : []
        return NextResponse.json({ content: localProspectReply(content, objections) })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
