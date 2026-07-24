import type { IntelligenceResult } from '../types'
import { httpUrl, number, object, providerJson, text } from './provider-http'

export async function enrichWithLusha(domain: string, key: string): Promise<IntelligenceResult> {
    const data = await providerJson('https://api.lusha.com/v3/companies/search', {
        method: 'POST',
        headers: { api_key: key, 'content-type': 'application/json' },
        body: JSON.stringify({ companies: [{ domain }] }),
    }, 'Lusha')
    const results = Array.isArray(data.results) ? data.results : []
    const row = object(results[0])
    const company = object(row.company || row)
    const location = object(company.location || company.headquarters)
    const employeeCount = number(company.employeeCount) ?? number(company.employees)
    return {
        provider: 'lusha',
        providerName: 'Lusha',
        domain,
        company: {
            name: text(company.name) || undefined,
            domain: text(company.domain) || domain,
            description: text(company.description, 2_000) || undefined,
            industry: text(company.industry) || text(object(company.primaryIndustry).name) || undefined,
            employeeCount,
            annualRevenue: text(company.revenue) || text(company.revenueRange) || undefined,
            city: text(location.city) || undefined,
            state: text(location.state) || undefined,
            country: text(location.country) || undefined,
            linkedinUrl: httpUrl(company.linkedinUrl) || undefined,
        },
        contacts: [],
        observedAt: new Date().toISOString(),
        costNotice: 'This explicit Lusha company search is billable per successful result. No contact fields are revealed automatically.',
    }
}
