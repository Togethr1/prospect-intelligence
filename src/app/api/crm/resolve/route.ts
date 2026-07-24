import { NextResponse } from 'next/server'
import { cleanText, publicError, readJsonObject, SafeRequestError } from '@/lib/security'
import { assertExtensionPaired } from '@/integrations/pairing'
import { resolveConnectedCrm } from '@/integrations/crm/resolve'
import { enforceRateLimit } from '@/lib/rate-limit'

function normalizeDomain(value: string) {
    const withScheme = /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`
    let hostname = ''
    try { hostname = new URL(withScheme).hostname.toLowerCase() } catch { return '' }
    hostname = hostname.replace(/^www\./, '')
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.local')) return ''
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname)) return ''
    return hostname
}

export async function POST(request: Request) {
    try {
        const body = await readJsonObject(request)
        assertExtensionPaired(request)
        enforceRateLimit('crm:resolve', 20, 60_000)
        const domain = normalizeDomain(cleanText(body.domain || body.url, 2_048))
        if (!domain) throw new SafeRequestError('A valid public company domain is required.')
        try {
            return NextResponse.json(await resolveConnectedCrm(domain))
        } catch (error) {
            throw new SafeRequestError(error instanceof Error ? error.message : 'CRM lookup failed.', 422)
        }
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
