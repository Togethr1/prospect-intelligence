import { NextResponse } from 'next/server'
import { assertExtensionPaired } from '@/integrations/pairing'
import { resolveIntelligence } from '@/integrations/intelligence/resolve'
import { listIntegrationSummaries } from '@/integrations/credential-broker'
import { cleanText, publicError, readJsonObject, SafeRequestError } from '@/lib/security'
import { enforceRateLimit } from '@/lib/rate-limit'

function domainFromUrl(value: string) {
    let parsed: URL
    try {
        parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    } catch {
        throw new SafeRequestError('Enter a valid website URL.')
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new SafeRequestError('Only HTTP and HTTPS websites are supported.')
    }
    const domain = parsed.hostname.toLowerCase().replace(/^www\./, '')
    if (!domain || domain === 'localhost' || domain.endsWith('.local')) {
        throw new SafeRequestError('Enter a public company website.')
    }
    return domain
}

export async function GET(request: Request) {
    try {
        assertExtensionPaired(request)
        const providers = listIntegrationSummaries()
            .filter((item) => item.category === 'sales-intelligence' && item.available && item.status === 'connected')
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
        enforceRateLimit('intelligence:resolve', 10, 60_000)
        const providerId = cleanText(body.providerId, 80)
        const url = cleanText(body.url, 2_048)
        if (!providerId || !url) throw new SafeRequestError('Provider and website URL are required.')
        try {
            return NextResponse.json(await resolveIntelligence(providerId, domainFromUrl(url)))
        } catch (error) {
            throw new SafeRequestError(error instanceof Error ? error.message : 'Provider lookup failed.', 422)
        }
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
