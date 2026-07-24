const baseUrl = 'http://localhost:5178'
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

export interface AiSynthesisResult {
    provider: string
    providerName: string
    model: string
    content: string
    citations: string[]
    costNotice: string
}

export interface ReviewInsightsResult {
    provider: string
    providerName: string
    placeName: string
    placeUrl?: string
    rating?: number
    reviewCount?: number
    reviews: Array<{
        id: string
        rating?: number
        text: string
        publishedAt?: string
        author?: string
        authorUrl?: string
        sourceUrl?: string
    }>
    trends: string[]
    costNotice: string
    coverageNotice: string
}

export interface LocalContext {
    knowledgeItems: Array<{
        id: string
        content: string
        metadata?: { type?: string; title?: string }
    }>
    personas: Array<{
        id: string
        name: string
        personality_config: {
            jobTitle?: string
            industry?: string
            scenario?: string
            personalityType?: string
            keyObjections?: string[]
            buyingCriteria?: string[]
        }
    }>
    researchRecords: Array<{
        id: string
        url: string
        title: string
        sales_assets: unknown
        crm_context?: unknown
        updated_at: string
    }>
}

export interface TranscriptionSession {
    token: string
    websocketUrl: string
    sampleRate: number
    maxSessionSeconds: number
    costNotice: string
}

export interface TranscriptionStatus {
    connected: boolean
    provider: string
    costNotice: string
}

export interface AssistantMessage {
    role: 'user' | 'assistant'
    content: string
}

function storageGet<T>(key: string): Promise<T | undefined> {
    if (!globalThis.chrome?.storage?.local) return Promise.resolve(undefined)
    return new Promise((resolve) => chrome.storage.local.get(key, (result) => resolve(result[key] as T | undefined)))
}

function storageSet(values: Record<string, unknown>): Promise<void> {
    if (!globalThis.chrome?.storage?.local) return Promise.resolve()
    return new Promise((resolve) => chrome.storage.local.set(values, resolve))
}

export async function requestExtensionApproval() {
    const response = await fetch(`${baseUrl}/api/pairing`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'request' }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Could not request dashboard access.')
    return data as { requestId: string; expiresAt: string }
}

export async function checkExtensionApproval(requestId: string) {
    const response = await fetch(`${baseUrl}/api/pairing`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'status', requestId }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Could not check dashboard approval.')
    if (data.status === 'approved' && data.token) {
        await storageSet({ [TOKEN_KEY]: data.token })
        return true
    }
    return false
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

export async function sendResearchChat(
    systemPrompt: string,
    messages: AssistantMessage[],
): Promise<{ content: string }> {
    const response = await fetch(`${baseUrl}/api/research/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...await pairedHeaders() },
        body: JSON.stringify({ systemPrompt, messages }),
    })
    const data = await response.json()
    if (response.status === 401) throw new Error('PAIRING_REQUIRED')
    if (!response.ok) throw new Error(data.error || 'Research assistant failed.')
    return data
}

export async function getLocalContext(): Promise<LocalContext> {
    const response = await fetch(`${baseUrl}/api/context`, { headers: await pairedHeaders() })
    const data = await response.json()
    if (response.status === 401) throw new Error('PAIRING_REQUIRED')
    if (!response.ok) throw new Error(data.error || 'Could not load local context.')
    return data
}

export async function sendAssistantMessage(providerId: string, messages: AssistantMessage[]): Promise<AiSynthesisResult> {
    const response = await fetch(`${baseUrl}/api/assistant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...await pairedHeaders() },
        body: JSON.stringify({ providerId, messages }),
    })
    const data = await response.json()
    if (response.status === 401) throw new Error('PAIRING_REQUIRED')
    if (!response.ok) throw new Error(data.error || 'The assistant could not respond.')
    return data
}

export async function requestTranscriptionSession(): Promise<TranscriptionSession> {
    const response = await fetch(`${baseUrl}/api/transcription/session`, {
        method: 'POST',
        headers: await pairedHeaders(),
    })
    const data = await response.json()
    if (response.status === 401) throw new Error('PAIRING_REQUIRED')
    if (!response.ok) throw new Error(data.error || 'Could not start transcription.')
    return data
}

export async function getTranscriptionStatus(): Promise<TranscriptionStatus> {
    const response = await fetch(`${baseUrl}/api/transcription/session`, {
        headers: await pairedHeaders(),
    })
    const data = await response.json()
    if (response.status === 401) throw new Error('PAIRING_REQUIRED')
    if (!response.ok) throw new Error(data.error || 'Could not load transcription status.')
    return data
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

export async function listAiProviders(): Promise<IntelligenceProvider[]> {
    const response = await fetch(`${baseUrl}/api/ai/synthesize`, { headers: await pairedHeaders() })
    const data = await response.json()
    if (response.status === 401) throw new Error('PAIRING_REQUIRED')
    if (!response.ok) throw new Error(data.error || 'Could not load AI providers.')
    return data.providers || []
}

export async function runAiProvider(providerId: string, prompt: string): Promise<AiSynthesisResult> {
    const response = await fetch(`${baseUrl}/api/ai/synthesize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...await pairedHeaders() },
        body: JSON.stringify({ providerId, prompt }),
    })
    const data = await response.json()
    if (response.status === 401) throw new Error('PAIRING_REQUIRED')
    if (!response.ok) throw new Error(data.error || 'AI synthesis failed.')
    return data
}

export async function listReviewProviders(): Promise<IntelligenceProvider[]> {
    const response = await fetch(`${baseUrl}/api/places`, { headers: await pairedHeaders() })
    const data = await response.json()
    if (response.status === 401) throw new Error('PAIRING_REQUIRED')
    if (!response.ok) throw new Error(data.error || 'Could not load review providers.')
    return data.providers || []
}

export async function runReviewProvider(providerId: string, query: string): Promise<ReviewInsightsResult> {
    const response = await fetch(`${baseUrl}/api/places`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...await pairedHeaders() },
        body: JSON.stringify({ providerId, query }),
    })
    const data = await response.json()
    if (response.status === 401) throw new Error('PAIRING_REQUIRED')
    if (!response.ok) throw new Error(data.error || 'Review lookup failed.')
    return data
}

export async function saveLocalResearch(url: string, title: string, salesAssets: unknown) {
    const response = await fetch(`${baseUrl}/api/local/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...await pairedHeaders() },
        body: JSON.stringify({ url, title, salesAssets, source: 'extension' }),
    })
    const data = await response.json()
    if (response.status === 401) throw new Error('PAIRING_REQUIRED')
    if (!response.ok) throw new Error(data.error || 'Research could not be saved locally.')
    return data
}
