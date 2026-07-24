import type { IntelligenceResult } from '../types'
import { number, object, providerJson, text } from './provider-http'

export async function enrichWithApollo(domain: string, credential: string): Promise<IntelligenceResult> {
    const params = new URLSearchParams({ domain })
    const data = await providerJson(
        `https://api.apollo.io/api/v1/organizations/enrich?${params}`,
        { headers: { accept: 'application/json', authorization: `Bearer ${credential}` } },
        'Apollo',
    )
    const organization = object(data.organization)
    const primaryPhone = object(organization.primary_phone)
    return {
        provider: 'apollo',
        providerName: 'Apollo',
        domain,
        company: {
            name: text(organization.name, 200) || undefined,
            domain,
            description: text(organization.short_description ?? organization.seo_description, 1_000) || undefined,
            industry: text(organization.industry, 200) || undefined,
            employeeCount: number(organization.estimated_num_employees),
            annualRevenue: text(organization.annual_revenue_printed, 100) || undefined,
            city: text(organization.city, 120) || undefined,
            state: text(organization.state, 120) || undefined,
            country: text(organization.country, 120) || undefined,
            linkedinUrl: text(organization.linkedin_url, 500) || undefined,
        },
        contacts: primaryPhone.number ? [{
            id: `apollo-company-${domain}`,
            name: text(organization.name, 200) || domain,
            title: 'Company phone',
            phone: text(primaryPhone.number, 80) || undefined,
        }] : [],
        observedAt: new Date().toISOString(),
        costNotice: 'Apollo documents this organization enrichment as consuming 1 credit when a match is found.',
    }
}
