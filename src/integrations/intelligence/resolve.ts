import { getCredential } from '../credential-broker'
import type { IntelligenceResult } from '../types'
import { enrichWithApollo } from './apollo'
import { enrichWithHunter } from './hunter'

const runners: Record<string, (domain: string, credential: string) => Promise<IntelligenceResult>> = {
    apollo: enrichWithApollo,
    hunter: enrichWithHunter,
}

export const RUNNABLE_INTELLIGENCE_PROVIDERS = Object.keys(runners)

export async function resolveIntelligence(providerId: string, domain: string) {
    const runner = runners[providerId]
    if (!runner) throw new Error('This provider does not have a live API adapter yet.')
    const credential = getCredential(providerId)
    if (!credential) throw new Error('Connect this provider in dashboard Settings first.')
    return runner(domain, credential)
}
