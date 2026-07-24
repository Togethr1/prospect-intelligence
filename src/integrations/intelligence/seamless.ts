import type { IntelligenceResult } from '../types'
import { httpUrl, object, providerJson, text } from './provider-http'

function normalizedDomain(value: unknown) {
    const raw = text(value, 2_048)
    if (!raw) return ''
    try {
        return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
            .hostname.toLowerCase().replace(/^www\./, '')
    } catch {
        return ''
    }
}

function optionalNumber(value: unknown) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function firstText(value: unknown) {
    if (!Array.isArray(value)) return ''
    return value.map((item) => text(item, 200)).find(Boolean) || ''
}

export async function enrichWithSeamless(domain: string, apiKey: string): Promise<IntelligenceResult> {
    const payload = await providerJson('https://api.seamless.ai/api/client/v1/search/companies', {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Token: apiKey,
        },
        body: JSON.stringify({
            companyDomain: [domain],
            limit: 1,
        }),
    }, 'Seamless.AI')

    const rows = Array.isArray(payload.data) ? payload.data : []
    const candidate = object(rows[0])
    const matchedDomain = normalizedDomain(candidate.domain)
    const exact = matchedDomain === domain

    return {
        provider: 'seamless',
        providerName: 'Seamless.AI',
        domain,
        company: exact ? {
            name: text(candidate.name, 200) || undefined,
            domain,
            description: text(candidate.description, 1_000) || undefined,
            industry: firstText(candidate.industries) || undefined,
            employeeCount: optionalNumber(candidate.employeeCount),
            annualRevenue: text(candidate.annualRevenue, 100)
                || text(candidate.revenueRange, 100)
                || undefined,
            city: text(candidate.city, 120) || undefined,
            state: text(candidate.state, 120) || undefined,
            country: text(candidate.country, 120) || undefined,
            linkedinUrl: httpUrl(candidate.companyLIURL, 500)
                || httpUrl(candidate.liUrl, 500)
                || undefined,
        } : undefined,
        contacts: [],
        observedAt: new Date().toISOString(),
        costNotice: 'Seamless.AI documents Search as consuming 1 Universal Credit per 1–10 returned results. This request is capped at one company and does not run company research or reveal contacts.',
    }
}
