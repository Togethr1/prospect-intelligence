import type { IntegrationDefinition } from './types'

const sales = (
    id: string,
    name: string,
    auth: IntegrationDefinition['auth'],
    cost: IntegrationDefinition['cost'],
    available: boolean,
    note: string,
): IntegrationDefinition => ({
    id, name, category: 'sales-intelligence', auth, cost, available, note,
    credentialLabel: auth === 'oauth' ? 'OAuth connection' : 'API key',
    capabilities: ['Company research', 'Contact discovery', 'Enrichment'],
})

const ai = (id: string, name: string, note: string): IntegrationDefinition => ({
    id, name, category: 'ai', auth: 'api-key', cost: 'metered', available: false, note,
    credentialLabel: 'API key',
    capabilities: ['Call plans', 'Research synthesis', 'Coaching'],
})

export const INTEGRATIONS: IntegrationDefinition[] = [
    {
        id: 'hubspot',
        name: 'HubSpot',
        category: 'crm',
        auth: 'access-token',
        credentialLabel: 'Private app access token',
        cost: 'none',
        capabilities: ['Website matching', 'Contacts', 'Deals'],
        available: true,
        note: 'Read-only pilot. Use a private app token limited to CRM read scopes.',
    },
    {
        id: 'salesforce',
        name: 'Salesforce',
        category: 'crm',
        auth: 'oauth',
        credentialLabel: 'OAuth connection',
        cost: 'contract',
        capabilities: ['Accounts', 'Contacts', 'Opportunities', 'Activities'],
        available: false,
        note: 'Planned OAuth integration.',
    },
    ...[
        ['pipedrive', 'Pipedrive'], ['close', 'Close'], ['zoho', 'Zoho CRM'],
        ['dynamics', 'Microsoft Dynamics 365'], ['attio', 'Attio'],
    ].map(([id, name]) => ({
        id, name, category: 'crm' as const, auth: 'oauth' as const,
        credentialLabel: 'OAuth connection', cost: 'contract' as const,
        capabilities: ['Accounts', 'Contacts', 'Opportunities'],
        available: false, note: 'Planned connector.',
    })),
    sales('apollo', 'Apollo', 'api-key', 'credit', true, 'Live organization enrichment. Runs only when you explicitly request it and may consume 1 credit on a match.'),
    sales('hunter', 'Hunter', 'api-key', 'credit', true, 'Live domain search. Runs only when you explicitly request it and may consume credits when results are returned.'),
    sales('zoominfo', 'ZoomInfo', 'enterprise', 'contract', false, 'Requires approved enterprise API access.'),
    sales('seamless', 'Seamless.AI', 'enterprise', 'contract', false, 'Requires documented account API access.'),
    sales('lusha', 'Lusha', 'api-key', 'credit', false, 'Plan-gated API access.'),
    sales('snov', 'Snov.io', 'api-key', 'credit', false, 'Planned official API connector.'),
    sales('clearbit', 'Clearbit', 'enterprise', 'unknown', false, 'Pending verification of the supported HubSpot/Clearbit path.'),
    sales('rocketreach', 'RocketReach', 'api-key', 'credit', false, 'Planned official API connector.'),
    sales('linkedin-sales-navigator', 'LinkedIn Sales Navigator', 'oauth', 'contract', false, 'Approved partner or authorized import only. No UI scraping.'),
    sales('leadiq', 'LeadIQ', 'enterprise', 'contract', false, 'Requires approved API access.'),
    sales('clay', 'Clay', 'api-key', 'credit', false, 'Planned workflow/import connector; underlying sources stay visible.'),
    sales('6sense', '6sense', 'enterprise', 'contract', false, 'Requires enterprise API access.'),
    sales('bombora', 'Bombora', 'enterprise', 'contract', false, 'Requires licensed intent-data access.'),
    sales('demandbase', 'Demandbase', 'enterprise', 'contract', false, 'Requires tenant API access.'),
    sales('g2', 'G2', 'enterprise', 'contract', false, 'Requires authorized buyer-intent access.'),
    ai('anthropic', 'Claude', 'Planned Anthropic Messages adapter.'),
    ai('gemini', 'Gemini', 'Planned Gemini adapter with explicit free-tier and data-use warnings.'),
    ai('openai', 'OpenAI', 'Planned Responses API adapter.'),
    ai('perplexity', 'Perplexity', 'Planned native API adapter.'),
    ai('xai', 'Grok', 'Planned xAI adapter.'),
]

export function getIntegration(id: string) {
    return INTEGRATIONS.find((integration) => integration.id === id)
}
