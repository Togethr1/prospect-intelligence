import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { assertExtensionPaired } from '@/integrations/pairing'
import { synthesizeWithAi } from '@/integrations/ai/resolve'
import { listIntegrationSummaries } from '@/integrations/credential-broker'
import { cleanText, publicError, readJsonObject, SafeRequestError } from '@/lib/security'

const coachingRateGlobal = globalThis as typeof globalThis & {
    __extensionCoachingRequests?: Map<string, number>
}
const coachingRequests = coachingRateGlobal.__extensionCoachingRequests ?? new Map<string, number>()
coachingRateGlobal.__extensionCoachingRequests = coachingRequests

function enforceExtensionCoachingRate(request: Request) {
    const origin = request.headers.get('origin') || ''
    if (!origin.startsWith('chrome-extension://')) return
    assertExtensionPaired(request)
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
    const key = createHash('sha256').update(bearer).digest('hex')
    const now = Date.now()
    const last = coachingRequests.get(key) || 0
    if (now - last < 10_000) {
        throw new SafeRequestError('Live coaching is limited to one AI request every ten seconds.', 429)
    }
    coachingRequests.set(key, now)
}

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
        enforceExtensionCoachingRate(request)
        const body = await readJsonObject(request)
        const providerId = cleanText(body.providerId, 80)
        const prompt = cleanText(body.prompt, 40_000)
        if (!providerId || prompt.length < 50) throw new SafeRequestError('Provider and research context are required.')
        try {
            return NextResponse.json(await synthesizeWithAi(providerId, prompt))
        } catch (error) {
            throw new SafeRequestError(error instanceof Error ? error.message : 'AI synthesis failed.', 422)
        }
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
