import { createHash } from 'node:crypto'
import { getIntegration, INTEGRATIONS } from './registry'
import type { IntegrationSummary } from './types'

interface StoredCredential {
    value: string
    fingerprint: string
    connectedAt: string
}

const globalBroker = globalThis as typeof globalThis & {
    __localCredentialBroker?: Map<string, StoredCredential>
}

const credentials = globalBroker.__localCredentialBroker ?? new Map<string, StoredCredential>()
globalBroker.__localCredentialBroker = credentials

export function storeCredential(providerId: string, value: string) {
    const provider = getIntegration(providerId)
    if (!provider || !provider.available) throw new Error('This integration is not available yet.')
    if (value.length < 12 || value.length > 4_096) throw new Error('Credential length is invalid.')
    const fingerprint = createHash('sha256').update(value).digest('hex').slice(-8).toUpperCase()
    credentials.set(providerId, { value, fingerprint, connectedAt: new Date().toISOString() })
}

export function deleteCredential(providerId: string) {
    credentials.delete(providerId)
}

export function getCredential(providerId: string) {
    return credentials.get(providerId)?.value
}

export function listIntegrationSummaries(): IntegrationSummary[] {
    return INTEGRATIONS.map((provider) => {
        const stored = credentials.get(provider.id)
        return {
            ...provider,
            status: stored ? 'connected' : 'disconnected',
            fingerprint: stored?.fingerprint,
            connectedAt: stored?.connectedAt,
        }
    })
}
