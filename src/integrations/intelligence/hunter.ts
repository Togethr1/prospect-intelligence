import type { IntelligenceContact, IntelligenceResult } from '../types'
import { httpUrl, number, object, providerJson, text } from './provider-http'

export async function enrichWithHunter(domain: string, credential: string): Promise<IntelligenceResult> {
    const params = new URLSearchParams({ domain, limit: '10' })
    const payload = await providerJson(
        `https://api.hunter.io/v2/domain-search?${params}`,
        { headers: { accept: 'application/json', 'X-API-KEY': credential } },
        'Hunter',
    )
    const data = object(payload.data)
    const organization = text(data.organization, 200)
    const emails = Array.isArray(data.emails) ? data.emails : []
    const contacts: IntelligenceContact[] = emails.slice(0, 10).map((value, index) => {
        const email = object(value)
        const first = text(email.first_name, 100)
        const last = text(email.last_name, 100)
        return {
            id: text(email.value, 320) || `hunter-${index}`,
            name: [first, last].filter(Boolean).join(' ') || text(email.value, 320) || 'Unknown contact',
            title: text(email.position, 200) || undefined,
            email: text(email.value, 320) || undefined,
            phone: text(email.phone_number, 80) || undefined,
            linkedinUrl: httpUrl(email.linkedin, 500) || undefined,
            confidence: number(email.confidence),
        }
    })
    return {
        provider: 'hunter',
        providerName: 'Hunter',
        domain,
        company: {
            name: organization || undefined,
            domain,
            description: text(data.description, 1_000) || undefined,
            industry: text(data.industry, 200) || undefined,
            city: text(data.city, 120) || undefined,
            state: text(data.state, 120) || undefined,
            country: text(data.country, 120) || undefined,
        },
        contacts,
        observedAt: new Date().toISOString(),
        costNotice: 'Hunter documents Domain Search as credit-consuming when results are returned.',
    }
}
