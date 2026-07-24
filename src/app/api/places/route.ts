import { NextResponse } from 'next/server'
import { assertExtensionPaired } from '@/integrations/pairing'
import { listIntegrationSummaries } from '@/integrations/credential-broker'
import { resolveReviews } from '@/integrations/reviews/resolve'
import { cleanText, publicError, readJsonObject, SafeRequestError } from '@/lib/security'
import { enforceRateLimit } from '@/lib/rate-limit'

export async function GET(request: Request) {
    try {
        assertExtensionPaired(request)
        const providers = listIntegrationSummaries()
            .filter((item) => item.category === 'reviews' && item.available && item.status === 'connected')
            .map(({ id, name, cost, note }) => ({ id, name, cost, note }))
        return NextResponse.json({ providers })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}

export async function POST(request: Request) {
    try {
        const origin = request.headers.get('origin') || ''
        if (origin.startsWith('chrome-extension://')) assertExtensionPaired(request)
        const body = await readJsonObject(request)
        enforceRateLimit('reviews:resolve', 10, 60_000)
        const providerId = cleanText(body.providerId, 80)
        const query = cleanText(body.query, 500)
        if (!providerId || query.length < 2) throw new SafeRequestError('Provider and business query are required.')
        try {
            return NextResponse.json(await resolveReviews(providerId, query))
        } catch (error) {
            throw new SafeRequestError(error instanceof Error ? error.message : 'Review lookup failed.', 422)
        }
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
