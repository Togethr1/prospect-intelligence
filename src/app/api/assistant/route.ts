import { NextResponse } from 'next/server'
import { assertExtensionPaired } from '@/integrations/pairing'
import { chatWithAi, type AssistantMessage } from '@/integrations/ai/resolve'
import { listIntegrationSummaries } from '@/integrations/credential-broker'
import { db } from '@/lib/local-db'
import { cleanText, publicError, readJsonObject, SafeRequestError } from '@/lib/security'
import { enforceRateLimit } from '@/lib/rate-limit'

export async function GET(request: Request) {
    try {
        assertExtensionPaired(request)
        const providers = listIntegrationSummaries()
            .filter((item) => item.category === 'ai' && item.available && item.status === 'connected')
            .map(({ id, name, cost, note }) => ({ id, name, cost, note }))
        return NextResponse.json({ providers })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}

export async function POST(request: Request) {
    try {
        if ((request.headers.get('origin') || '').startsWith('chrome-extension://')) {
            assertExtensionPaired(request)
        }
        const body = await readJsonObject(request)
        enforceRateLimit('ai:assistant', 6, 60_000)
        const providerId = cleanText(body.providerId, 80)
        const rawMessages = Array.isArray(body.messages) ? body.messages.slice(-16) : []
        const messages: AssistantMessage[] = rawMessages.flatMap((entry) => {
            if (!entry || typeof entry !== 'object') return []
            const record = entry as Record<string, unknown>
            const role = record.role === 'assistant' ? 'assistant' : record.role === 'user' ? 'user' : null
            const content = cleanText(record.content, 4_000)
            return role && content ? [{ role, content }] : []
        })
        if (!providerId || !messages.length || messages.at(-1)?.role !== 'user') {
            throw new SafeRequestError('Choose a connected AI provider and enter a message.')
        }
        const knowledgeContext = db.getKnowledgeItems().slice(0, 20).map((item) =>
            `[Knowledge: ${item.metadata.title}] ${item.content.slice(0, 1_000)}`
        ).join('\n\n')
        const personaContext = db.getPersonas().slice(0, 10).map((persona) =>
            `[Persona: ${persona.name}] ${JSON.stringify(persona.personality_config)}`
        ).join('\n\n')
        const researchContext = db.getResearchHistory().slice(0, 5).map((record) =>
            `[Research: ${record.title} · ${record.url}] ${JSON.stringify(record.sales_assets).slice(0, 4_000)}${record.crm_context ? ` CRM: ${JSON.stringify(record.crm_context).slice(0, 1_500)}` : ''}`
        ).join('\n\n')
        const localContext = [knowledgeContext, personaContext, researchContext].filter(Boolean).join('\n\n').slice(0, 24_000)
        return NextResponse.json(await chatWithAi(providerId, messages, localContext))
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
