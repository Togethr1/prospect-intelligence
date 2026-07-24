import { NextResponse } from 'next/server'
import { cleanText, publicError, readJsonObject, SafeRequestError } from '@/lib/security'
import { assertExtensionPaired } from '@/integrations/pairing'
import { getCredential } from '@/integrations/credential-broker'
import { resolveHubSpotDomain } from '@/integrations/crm/hubspot'

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
        const domain = normalizeDomain(cleanText(body.domain || body.url, 2_048))
        if (!domain) throw new SafeRequestError('A valid public company domain is required.')
        const token = getCredential('hubspot')
        if (!token) {
            return NextResponse.json({
                provider: 'hubspot',
                match: 'none',
                contacts: [],
                opportunities: [],
                observedAt: new Date().toISOString(),
                disconnected: true,
            })
        }
        return NextResponse.json(await resolveHubSpotDomain(domain, token))
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
