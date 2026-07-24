import { NextResponse } from 'next/server'
import { LIMITS, cleanText, publicError, readJsonObject } from '@/lib/security'
import { assertExtensionPaired } from '@/integrations/pairing'
import { localResearchReply } from '@/lib/local-analysis'

export async function POST(request: Request) {
    try {
        const body = await readJsonObject(request)
        assertExtensionPaired(request)
        const messages = Array.isArray(body.messages) ? body.messages.slice(-LIMITS.messages) : []
        const last = [...messages].reverse().find((item) => item && typeof item === 'object' && (item as { role?: unknown }).role === 'user')
        const question = cleanText((last as { content?: unknown } | undefined)?.content, LIMITS.messageChars)
        const context = cleanText(body.systemPrompt, LIMITS.pageTextChars)
        if (!question) return NextResponse.json({ error: 'A question is required.' }, { status: 400 })
        return NextResponse.json({ content: localResearchReply(question, context) })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
