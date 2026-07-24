export type IntegrationCategory = 'crm' | 'sales-intelligence' | 'ai'
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
