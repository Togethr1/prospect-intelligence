import { SafeRequestError } from '@/lib/security'

export interface LiveKitCredentials {
    url: string
    apiKey: string
    apiSecret: string
}

export function parseLiveKitCredential(raw: string): LiveKitCredentials {
    let value: unknown
    try {
        value = JSON.parse(raw)
    } catch {
        throw new SafeRequestError('LiveKit credentials must be valid JSON.')
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new SafeRequestError('LiveKit credentials must contain a Project URL, API key, and API secret.')
    }
    const record = value as Record<string, unknown>
    const url = typeof record.url === 'string' ? record.url.trim() : ''
    const apiKey = typeof record.apiKey === 'string' ? record.apiKey.trim() : ''
    const apiSecret = typeof record.apiSecret === 'string' ? record.apiSecret.trim() : ''
    let parsedUrl: URL
    try {
        parsedUrl = new URL(url)
    } catch {
        throw new SafeRequestError('Enter a valid LiveKit Project URL.')
    }
    const hostname = parsedUrl.hostname.toLowerCase().replace(/\.$/, '')
    if (
        !['wss:', 'https:'].includes(parsedUrl.protocol) ||
        !hostname.endsWith('.livekit.cloud') ||
        parsedUrl.username ||
        parsedUrl.password ||
        parsedUrl.port ||
        (parsedUrl.pathname && parsedUrl.pathname !== '/') ||
        parsedUrl.search ||
        parsedUrl.hash
    ) {
        throw new SafeRequestError('Enter the wss:// Project URL for a LiveKit Cloud project.')
    }
    if (apiKey.length < 8 || apiKey.length > 256 || apiSecret.length < 16 || apiSecret.length > 512) {
        throw new SafeRequestError('LiveKit API key or secret is invalid.')
    }
    return { url: parsedUrl.toString().replace(/\/$/, ''), apiKey, apiSecret }
}

export const ROLEPLAY_AGENT_NAME = 'prospect-roleplay'

export function resolveVoice(gender: 'man' | 'woman', tone: string) {
    const energetic = new Set(['energetic', 'friendly'])
    const forceful = new Set(['authoritative', 'direct', 'energetic'])
    if (gender === 'woman') {
        return { model: 'xai/tts-1', voice: energetic.has(tone) ? 'eve' : 'ara' }
    }
    return { model: 'xai/tts-1', voice: forceful.has(tone) ? 'leo' : 'rex' }
}
