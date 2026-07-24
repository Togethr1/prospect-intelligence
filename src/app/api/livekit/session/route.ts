import { NextResponse } from 'next/server'
import { AccessToken, LiveKitAPI } from 'livekit-server-sdk'
import { getCredential } from '@/integrations/credential-broker'
import { parseLiveKitCredential, ROLEPLAY_AGENT_NAME } from '@/integrations/livekit/config'
import { buildRoleplayPrompt } from '@/integrations/livekit/prompt'
import { ensureRoleplayWorker } from '@/integrations/livekit/worker-manager'
import { db } from '@/lib/local-db'
import { assertDashboardRequest, cleanText, publicError, readJsonObject, SafeRequestError } from '@/lib/security'
import { enforceRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(request: Request) {
    try {
        const body = await readJsonObject(request)
        assertDashboardRequest(request)
        enforceRateLimit('livekit:start', 3, 60_000)
        const personaId = cleanText(body.personaId, 100)
        const persona = db.getPersonaById(personaId)
        if (!persona) throw new SafeRequestError('The selected prospect no longer exists.', 404)
        const rawCredential = getCredential('livekit')
        if (!rawCredential) throw new SafeRequestError('Connect LiveKit in Settings before starting a voice roleplay.', 409)
        const credentials = parseLiveKitCredential(rawCredential)
        try {
            await ensureRoleplayWorker(credentials)
        } catch {
            throw new SafeRequestError('The local LiveKit voice worker could not connect. Reconnect LiveKit in Settings and try again.', 422)
        }

        const knowledge = db.getKnowledgeItems().slice(0, 20).map((item) =>
            `[${item.metadata.title}] ${item.content.slice(0, 800)}`
        )
        const config = persona.personality_config
        const prompt = buildRoleplayPrompt({
            name: persona.name,
            jobTitle: config.jobTitle,
            industry: config.industry,
            scenario: config.scenario || 'This is a cold call. The seller is trying to earn a relevant next step.',
            personalityType: config.personalityType,
            voiceTone: config.voiceTone || 'professional',
            keyObjections: config.keyObjections,
            buyingCriteria: config.buyingCriteria,
        }, knowledge).slice(0, 32_000)

        const roomName = `roleplay-${crypto.randomUUID()}`
        const api = new LiveKitAPI({
            host: credentials.url,
            apiKey: credentials.apiKey,
            secret: credentials.apiSecret,
            requestTimeout: 10,
        })
        try {
            await api.agentDispatch.createDispatch(roomName, ROLEPLAY_AGENT_NAME, {
                metadata: JSON.stringify({
                    prompt,
                    voiceGender: config.voiceGender || 'woman',
                    voiceTone: config.voiceTone || 'professional',
                }),
            })
        } catch {
            throw new SafeRequestError('LiveKit could not create the roleplay room. Check your project permissions and usage limits.', 422)
        }

        const token = new AccessToken(credentials.apiKey, credentials.apiSecret, {
            identity: `seller-${crypto.randomUUID()}`,
            name: 'Seller',
            ttl: '15m',
        })
        token.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
        })

        return NextResponse.json({
            token: await token.toJwt(),
            serverUrl: credentials.url.replace(/^https:/, 'wss:'),
            roomName,
            personaName: persona.name,
            costNotice: 'This call uses your LiveKit Cloud project and consumes metered media and inference usage.',
        })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await readJsonObject(request)
        assertDashboardRequest(request)
        const roomName = cleanText(body.roomName, 120)
        if (!roomName.startsWith('roleplay-')) throw new SafeRequestError('Invalid roleplay room.')
        const rawCredential = getCredential('livekit')
        if (!rawCredential) return NextResponse.json({ closed: true })
        const credentials = parseLiveKitCredential(rawCredential)
        const api = new LiveKitAPI({
            host: credentials.url,
            apiKey: credentials.apiKey,
            secret: credentials.apiSecret,
            requestTimeout: 8,
        })
        try {
            await api.room.deleteRoom(roomName)
        } catch {
            // It may already have closed after the participant disconnected.
        }
        return NextResponse.json({ closed: true })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
