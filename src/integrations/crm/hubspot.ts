import type { CrmAccountContext, CrmContact, CrmOpportunity } from '../types'
import { object, providerJson, text } from '../intelligence/provider-http'

const HUBSPOT_BASE = 'https://api.hubapi.com'

async function hubspotFetch(path: string, token: string, init?: RequestInit) {
    return providerJson(`${HUBSPOT_BASE}${path}`, {
        ...init,
        headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
            ...(init?.headers || {}),
        },
    }, 'HubSpot', 10_000)
}

async function readAssociated<T>(
    token: string,
    objectType: 'contacts' | 'deals',
    ids: string[],
    properties: string[],
): Promise<Array<{ id: string; properties: T }>> {
    if (!ids.length) return []
    const data = await hubspotFetch(`/crm/v3/objects/${objectType}/batch/read`, token, {
        method: 'POST',
        body: JSON.stringify({ inputs: ids.slice(0, 10).map((id) => ({ id })), properties }),
    })
    if (!Array.isArray(data.results)) return []
    return data.results.flatMap((raw) => {
        const row = object(raw)
        const id = text(row.id, 200)
        if (!id) return []
        return [{ id, properties: object(row.properties) as T }]
    })
}

export async function resolveHubSpotDomain(domain: string, token: string): Promise<CrmAccountContext> {
    const search = await hubspotFetch('/crm/v3/objects/companies/search', token, {
        method: 'POST',
        body: JSON.stringify({
            filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: domain }] }],
            properties: ['name', 'domain', 'industry', 'city', 'state', 'country', 'lifecyclestage', 'hubspot_owner_id'],
            limit: 2,
        }),
    })
    const companies = Array.isArray(search.results) ? search.results : []
    const company = object(companies[0])
    const companyId = text(company.id, 200)
    if (!companyId) return { provider: 'hubspot', match: 'none', contacts: [], opportunities: [], observedAt: new Date().toISOString() }

    const detailed = await hubspotFetch(
        `/crm/v3/objects/companies/${encodeURIComponent(companyId)}?associations=contacts,deals&properties=name,domain,industry,city,state,country,lifecyclestage,hubspot_owner_id`,
        token,
    )
    const associations = object(detailed.associations)
    const associationIds = (name: 'contacts' | 'deals') => {
        const results = object(associations[name]).results
        return Array.isArray(results)
            ? results.map((item) => text(object(item).id, 200)).filter(Boolean).slice(0, 10)
            : []
    }
    const contactIds = associationIds('contacts')
    const dealIds = associationIds('deals')
    const [contactRows, dealRows] = await Promise.all([
        readAssociated<Record<string, string>>(token, 'contacts', contactIds, ['firstname', 'lastname', 'jobtitle', 'email', 'phone']),
        readAssociated<Record<string, string>>(token, 'deals', dealIds, ['dealname', 'dealstage', 'amount', 'closedate']),
    ])
    const contacts: CrmContact[] = contactRows.map((row) => ({
        id: row.id,
        name: [row.properties.firstname, row.properties.lastname].filter(Boolean).join(' ') || 'Unnamed contact',
        title: row.properties.jobtitle,
        email: row.properties.email,
        phone: row.properties.phone,
    }))
    const opportunities: CrmOpportunity[] = dealRows.map((row) => ({
        id: row.id,
        name: row.properties.dealname || 'Unnamed deal',
        stage: row.properties.dealstage,
        amount: row.properties.amount,
        closeDate: row.properties.closedate,
    }))
    const p = object(detailed.properties)
    return {
        provider: 'hubspot',
        match: 'exact-domain',
        account: {
            id: text(detailed.id, 200) || companyId,
            name: text(p.name, 300) || domain,
            domain: text(p.domain, 300) || domain,
            owner: text(p.hubspot_owner_id, 300) || undefined,
            lifecycle: text(p.lifecyclestage, 300) || undefined,
            industry: text(p.industry, 300) || undefined,
            city: text(p.city, 300) || undefined,
            state: text(p.state, 300) || undefined,
            country: text(p.country, 300) || undefined,
        },
        contacts,
        opportunities,
        observedAt: new Date().toISOString(),
    }
}
