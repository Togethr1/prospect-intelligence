import { listIntegrationSummaries } from '@/integrations/credential-broker'
import { SettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export default function SettingsPage() {
    return <SettingsClient initialIntegrations={listIntegrationSummaries()} />
}
