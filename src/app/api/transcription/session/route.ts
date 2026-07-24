import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getCredential } from '@/integrations/credential-broker'
import { assertExtensionPaired } from '@/integrations/pairing'
import { publicError, SafeRequestError } from '@/lib/security'
import { providerJson } from '@/integrations/intelligence/provider-http'

const rateLimitGlobal = globalThis as typeof globalThis & {
    __transcriptionTokenMints?: Map<string, number[]>
}
const tokenMints = rateLimitGlobal.__transcriptionTokenMints ?? new Map<string, number[]>()
rateLimitGlobal.__transcriptionTokenMints = tokenMints

function assertPairedExtension(request: Request) {
    if (!(request.headers.get('origin') || '').startsWith('chrome-extension://')) {
        throw new SafeRequestError('This action must come from a paired Chrome extension.', 403)
    }
    assertExtensionPaired(request)
}

function enforceMintRate(request: Request) {
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
    const key = createHash('sha256').update(bearer).digest('hex')
    const now = Date.now()
    const recent = (tokenMints.get(key) || []).filter((time) => now - time < 5 * 60_000)
    if (recent.length >= 6) {
        throw new SafeRequestError('Too many transcription sessions were requested. Try again in a few minutes.', 429)
    }
    recent.push(now)
    tokenMints.set(key, recent)
}

export async function GET(request: Request) {
    try {
        assertPairedExtension(request)
        return NextResponse.json({
            connected: Boolean(getCredential('assemblyai')),
            provider: 'AssemblyAI',
            costNotice: 'Optional and metered only when selected for a live session.',
        })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}

export async function POST(request: Request) {
    try {
        assertPairedExtension(request)
        enforceMintRate(request)
        const apiKey = getCredential('assemblyai')
        if (!apiKey) throw new SafeRequestError('Connect AssemblyAI in Dashboard Settings first.', 409)

        const url = new URL('https://streaming.assemblyai.com/v3/token')
        url.searchParams.set('expires_in_seconds', '60')
        url.searchParams.set('max_session_duration_seconds', '7200')
        const data = await providerJson(url.toString(), {
            headers: { authorization: apiKey },
        }, 'AssemblyAI', 10_000)
        if (typeof data.token !== 'string' || data.token.length < 20) {
            throw new SafeRequestError('AssemblyAI could not create a streaming session.', 422)
        }
        return NextResponse.json({
            token: data.token,
            websocketUrl: 'wss://streaming.assemblyai.com/v3/ws',
            sampleRate: 16_000,
            maxSessionSeconds: 7_200,
            costNotice: 'AssemblyAI bills streaming for the time this session remains connected.',
        })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
