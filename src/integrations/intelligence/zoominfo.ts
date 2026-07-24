import type { IntelligenceResult } from '../types'
import { object, providerJson, text } from './provider-http'

interface ZoomInfoCredential {
    accessToken?: string
    clientId?: string
    clientSecret?: string
}

function parseCredential(raw: string): ZoomInfoCredential {
    try {
        const value = JSON.parse(raw) as Record<string, unknown>
        const accessToken = text(value.accessToken, 8_192)
        const clientId = text(value.clientId, 1_000)
        const clientSecret = text(value.clientSecret, 4_096)
        if (accessToken) return { accessToken }
        if (clientId && clientSecret) return { clientId, clientSecret }
    } catch {
        // Use the provider-specific message below.
    }
    throw new Error('ZoomInfo expects JSON with accessToken, or clientId and clientSecret.')
}

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

async function accessToken(rawCredential: string) {
    const credential = parseCredential(rawCredential)
    if (credential.accessToken) return credential.accessToken

    const basic = Buffer.from(`${credential.clientId}:${credential.clientSecret}`).toString('base64')
    const auth = await providerJson('https://api.zoominfo.com/gtm/oauth/v1/token', {
        method: 'POST',
        headers: {
            accept: 'application/json',
            authorization: `Basic ${basic}`,
            'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }),
    }, 'ZoomInfo')
    const token = text(auth.access_token, 8_192)
    if (!token) throw new Error('ZoomInfo did not return an access token.')
    return token
}

export async function enrichWithZoomInfo(domain: string, rawCredential: string): Promise<IntelligenceResult> {
    const token = await accessToken(rawCredential)
    const payload = await providerJson(
        'https://api.zoominfo.com/gtm/data/v1/companies/search?page[number]=1&page[size]=1',
        {
            method: 'POST',
            headers: {
                accept: 'application/vnd.api+json',
                authorization: `Bearer ${token}`,
                'content-type': 'application/vnd.api+json',
            },
            body: JSON.stringify({
                data: {
                    type: 'CompanySearch',
                    attributes: { companyWebsite: `https://${domain}` },
                },
            }),
        },
        'ZoomInfo',
    )

    const rows = Array.isArray(payload.data) ? payload.data : []
    const candidate = object(rows[0])
    const attributes = object(candidate.attributes)
    const matchedDomain = normalizedDomain(attributes.website)
    const exact = matchedDomain === domain

    return {
        provider: 'zoominfo',
        providerName: 'ZoomInfo',
        domain,
        company: exact ? {
            name: text(attributes.name, 200) || undefined,
            domain,
            employeeCount: optionalNumber(attributes.employeeCount),
            annualRevenue: text(attributes.revenue, 100) || undefined,
            city: text(attributes.city, 120) || undefined,
            state: text(attributes.state, 120) || undefined,
            country: text(attributes.country, 120) || undefined,
        } : undefined,
        contacts: [],
        observedAt: new Date().toISOString(),
        costNotice: 'ZoomInfo documents Company Search as non-credit-consuming, but it counts against request limits and requires licensed API access. No enrichment or contact reveal was run.',
    }
}
