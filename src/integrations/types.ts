export type IntegrationCategory = 'crm' | 'sales-intelligence' | 'reviews' | 'ai' | 'voice'
export type CostClass = 'none' | 'free-quota' | 'credit' | 'metered' | 'contract' | 'unknown'
export type IntegrationStatus = 'disconnected' | 'connected'

export interface IntegrationDefinition {
    id: string
    name: string
    category: IntegrationCategory
    auth: 'api-key' | 'access-token' | 'oauth' | 'enterprise'
    credentialLabel: string
    cost: CostClass
    capabilities: string[]
    available: boolean
    credentialConfigurable?: boolean
    note: string
}

export interface IntegrationSummary extends IntegrationDefinition {
    status: IntegrationStatus
    fingerprint?: string
    connectedAt?: string
}

export interface CrmContact {
    id: string
    name: string
    title?: string
    email?: string
    phone?: string
}

export interface CrmOpportunity {
    id: string
    name: string
    stage?: string
    amount?: string
    closeDate?: string
}

export interface CrmAccountContext {
    provider: string
    match: 'exact-domain' | 'none'
    account?: {
        id: string
        name: string
        domain: string
        owner?: string
        lifecycle?: string
        industry?: string
        city?: string
        state?: string
        country?: string
        sourceUrl?: string
    }
    contacts: CrmContact[]
    opportunities: CrmOpportunity[]
    observedAt: string
}

export interface IntelligenceContact {
    id: string
    name: string
    title?: string
    email?: string
    phone?: string
    linkedinUrl?: string
    confidence?: number
}

export interface IntelligenceCompany {
    name?: string
    domain: string
    description?: string
    industry?: string
    employeeCount?: number
    annualRevenue?: string
    city?: string
    state?: string
    country?: string
    linkedinUrl?: string
}

export interface IntelligenceResult {
    provider: string
    providerName: string
    domain: string
    company?: IntelligenceCompany
    contacts: IntelligenceContact[]
    observedAt: string
    costNotice: string
}

export interface AiSynthesisResult {
    provider: string
    providerName: string
    model: string
    content: string
    citations: string[]
    observedAt: string
    costNotice: string
}

export interface ReviewItem {
    id: string
    rating?: number
    text: string
    publishedAt?: string
    author?: string
    authorUrl?: string
    sourceUrl?: string
}

export interface ReviewInsightsResult {
    provider: string
    providerName: string
    placeName: string
    placeUrl?: string
    rating?: number
    reviewCount?: number
    reviews: ReviewItem[]
    trends: string[]
    observedAt: string
    costNotice: string
    coverageNotice: string
}
