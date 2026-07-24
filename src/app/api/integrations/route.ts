import { NextResponse } from 'next/server'
import { cleanText, publicError, readJsonObject, assertDashboardRequest, SafeRequestError } from '@/lib/security'
import { deleteCredential, listIntegrationSummaries, storeCredential } from '@/integrations/credential-broker'
import { LiveKitAPI } from 'livekit-server-sdk'
import { parseLiveKitCredential } from '@/integrations/livekit/config'
import { stopRoleplayWorker } from '@/integrations/livekit/worker-manager'

export async function GET(request: Request) {
    try {
        assertDashboardRequest(request)
        return NextResponse.json({ integrations: listIntegrationSummaries() })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}

export async function POST(request: Request) {
    try {
        const body = await readJsonObject(request)
        assertDashboardRequest(request)
        const providerId = cleanText(body.providerId, 80)
        const credential = cleanText(body.credential, 4_096)
        if (!providerId || !credential) return NextResponse.json({ error: 'Provider and credential are required.' }, { status: 400 })
        if (providerId === 'livekit') {
            const credentials = parseLiveKitCredential(credential)
            const api = new LiveKitAPI({
                host: credentials.url,
                apiKey: credentials.apiKey,
                secret: credentials.apiSecret,
                requestTimeout: 8,
            })
            try {
                await api.room.listRooms([])
            } catch {
                throw new SafeRequestError('LiveKit could not verify that Project URL, API key, and API secret.', 422)
            }
            stopRoleplayWorker()
        }
        storeCredential(providerId, credential)
        return NextResponse.json({ integrations: listIntegrationSummaries() })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await readJsonObject(request)
        assertDashboardRequest(request)
        const providerId = cleanText(body.providerId, 80)
        if (!providerId) return NextResponse.json({ error: 'Provider is required.' }, { status: 400 })
        if (providerId === 'livekit') stopRoleplayWorker()
        deleteCredential(providerId)
        return NextResponse.json({ integrations: listIntegrationSummaries() })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
