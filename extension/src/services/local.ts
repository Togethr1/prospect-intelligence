const baseUrl = 'http://localhost:3000'
const TOKEN_KEY = 'local_dashboard_pairing_token'

export interface CrmContext {
    provider: string
    match: 'exact-domain' | 'none'
    disconnected?: boolean
    account?: { name: string; domain: string; lifecycle?: string; industry?: string }
    contacts: Array<{ id: string; name: string; title?: string; email?: string }>
    opportunities: Array<{ id: string; name: string; stage?: string; amount?: string }>
}

export interface IntelligenceProvider {
    id: string
    name: string
    cost: string
    note: string
}

export interface IntelligenceResult {
    provider: string
    providerName: string
    domain: string
    company?: { name?: string; industry?: string; employeeCount?: number; annualRevenue?: string }
    contacts: Array<{ id: string; name: string; title?: string; email?: string; phone?: string; confidence?: number }>
    costNotice: string
}

function storageGet<T>(key: string): Promise<T | undefined> {
    return new Promise((resolve) => chrome.storage.local.get(key, (result) => resolve(result[key] as T | undefined)))
}

function storageSet(values: Record<string, unknown>): Promise<void> {
    return new Promise((resolve) => chrome.storage.local.set(values, resolve))
}

export async function redeemPairingCode(code: string) {
    const response = await fetch(`${baseUrl}/api/pairing`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'redeem', code }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Pairing failed.')
    await storageSet({ [TOKEN_KEY]: data.token })
}

export async function hasPairing() {
    return Boolean(await storageGet<string>(TOKEN_KEY))
}

export async function resolveCrm(url: string): Promise<CrmContext> {
    const token = await storageGet<string>(TOKEN_KEY)
    if (!token) throw new Error('PAIRING_REQUIRED')
    const response = await fetch(`${baseUrl}/api/crm/resolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ url }),
    })
    const data = await response.json()
    if (response.status === 401) throw new Error('PAIRING_REQUIRED')
    if (!response.ok) throw new Error(data.error || 'CRM lookup failed.')
    return data
}

async function pairedHeaders() {
    const token = await storageGet<string>(TOKEN_KEY)
    if (!token) throw new Error('PAIRING_REQUIRED')
    return { authorization: `Bearer ${token}` }
}

export async function listIntelligenceProviders(): Promise<IntelligenceProvider[]> {
    const response = await fetch(`${baseUrl}/api/intelligence/resolve`, { headers: await pairedHeaders() })
    const data = await response.json()
    if (response.status === 401) throw new Error('PAIRING_REQUIRED')
    if (!response.ok) throw new Error(data.error || 'Could not load providers.')
    return data.providers || []
}

export async function runIntelligenceProvider(providerId: string, url: string): Promise<IntelligenceResult> {
    const response = await fetch(`${baseUrl}/api/intelligence/resolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...await pairedHeaders() },
        body: JSON.stringify({ providerId, url }),
    })
    const data = await response.json()
    if (response.status === 401) throw new Error('PAIRING_REQUIRED')
    if (!response.ok) throw new Error(data.error || 'Provider lookup failed.')
    return data
}
