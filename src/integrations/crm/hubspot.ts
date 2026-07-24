import type { CrmAccountContext, CrmContact, CrmOpportunity } from '../types'

const HUBSPOT_BASE = 'https://api.hubapi.com'

async function hubspotFetch(path: string, token: string, init?: RequestInit) {
    const response = await fetch(`${HUBSPOT_BASE}${path}`, {
        ...init,
        headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
            ...(init?.headers || {}),
        },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
    })
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error('HubSpot rejected the credential or required scopes.')
        if (response.status === 429) throw new Error('HubSpot rate limit reached.')
        throw new Error('HubSpot request failed.')
    }
    return response.json()
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
    return Array.isArray(data.results) ? data.results : []
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
    const company = search.results?.[0]
    if (!company) return { provider: 'hubspot', match: 'none', contacts: [], opportunities: [], observedAt: new Date().toISOString() }

    const detailed = await hubspotFetch(
        `/crm/v3/objects/companies/${encodeURIComponent(company.id)}?associations=contacts,deals&properties=name,domain,industry,city,state,country,lifecyclestage,hubspot_owner_id`,
        token,
    )
    const contactIds = (detailed.associations?.contacts?.results || []).map((item: { id: string }) => item.id)
    const dealIds = (detailed.associations?.deals?.results || []).map((item: { id: string }) => item.id)
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
    const p = detailed.properties || {}
    return {
        provider: 'hubspot',
        match: 'exact-domain',
        account: {
            id: detailed.id,
            name: p.name || domain,
            domain: p.domain || domain,
            owner: p.hubspot_owner_id,
            lifecycle: p.lifecyclestage,
            industry: p.industry,
            city: p.city,
            state: p.state,
            country: p.country,
        },
        contacts,
        opportunities,
        observedAt: new Date().toISOString(),
    }
}
