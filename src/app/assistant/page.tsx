import { listIntegrationSummaries } from '@/integrations/credential-broker'
import { AssistantClient } from './assistant-client'

export const dynamic = 'force-dynamic'

export default function AssistantPage() {
    const providers = listIntegrationSummaries()
        .filter((item) => item.category === 'ai' && item.available && item.status === 'connected')
        .map(({ id, name, note }) => ({ id, name, note }))
    return <AssistantClient initialProviders={providers} />
}
