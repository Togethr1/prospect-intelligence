import type { IntelligenceResult } from '../types'
import { object, providerJson, text } from './provider-http'

function parseCredential(raw: string) {
    try {
        const value = JSON.parse(raw) as Record<string, unknown>
        const clientId = text(value.clientId, 1_000)
        const clientSecret = text(value.clientSecret, 2_000)
        if (!clientId || !clientSecret) throw new Error()
        return { clientId, clientSecret }
    } catch {
        throw new Error('Snov.io expects JSON with clientId and clientSecret.')
    }
}

export async function enrichWithSnov(domain: string, rawCredential: string): Promise<IntelligenceResult> {
    const credential = parseCredential(rawCredential)
    const authBody = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credential.clientId,
        client_secret: credential.clientSecret,
    })
    const auth = await providerJson('https://api.snov.io/v1/oauth/access_token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: authBody,
    }, 'Snov.io')
    const token = text(auth.access_token, 4_096)
    if (!token) throw new Error('Snov.io did not return an access token.')
    const headers = { authorization: `Bearer ${token}` }
    const start = await providerJson(`https://api.snov.io/v2/domain-search/start?domain=${encodeURIComponent(domain)}`, {
        method: 'POST',
        headers,
    }, 'Snov.io')
    const taskHash = text(object(start.meta).task_hash, 300)
    if (!taskHash) throw new Error('Snov.io did not start the domain search.')

    let result: Record<string, unknown> = {}
    for (let attempt = 0; attempt < 6; attempt += 1) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1_000))
        result = await providerJson(`https://api.snov.io/v2/domain-search/result/${encodeURIComponent(taskHash)}`, { headers }, 'Snov.io')
        if (text(result.status, 50) === 'completed') break
    }
    if (text(result.status, 50) !== 'completed') throw new Error('Snov.io is still processing this lookup. Run it again shortly.')
    const company = object(result.data)
    return {
        provider: 'snov',
        providerName: 'Snov.io',
        domain,
        company: {
            name: text(company.company_name) || undefined,
            domain,
            industry: text(company.industry) || undefined,
            employeeCount: (() => {
                const range = text(company.size)
                const high = Number(range.split('-').pop())
                return Number.isFinite(high) ? high : undefined
            })(),
            city: text(company.city) || undefined,
        },
        contacts: [],
        observedAt: new Date().toISOString(),
        costNotice: 'This explicit Snov.io domain search may consume one or more credits under your account plan.',
    }
}
