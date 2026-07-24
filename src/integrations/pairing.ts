import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { SafeRequestError } from '@/lib/security'

interface PairingCode { expiresAt: number }
interface PairedToken { extensionId: string; createdAt: string }

const pairingGlobal = globalThis as typeof globalThis & {
    __pairingCodes?: Map<string, PairingCode>
    __pairedTokens?: Map<string, PairedToken>
}
const codes = pairingGlobal.__pairingCodes ?? new Map<string, PairingCode>()
const tokens = pairingGlobal.__pairedTokens ?? new Map<string, PairedToken>()
pairingGlobal.__pairingCodes = codes
pairingGlobal.__pairedTokens = tokens

const hash = (value: string) => createHash('sha256').update(value).digest('hex')

export function createPairingCode() {
    codes.clear()
    const code = String(randomInt(100_000, 1_000_000))
    codes.set(hash(code), { expiresAt: Date.now() + 5 * 60_000 })
    return { code, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() }
}

export function redeemPairingCode(code: string, extensionId: string) {
    const key = hash(code)
    const record = codes.get(key)
    if (!record || record.expiresAt < Date.now()) throw new SafeRequestError('Pairing code is invalid or expired.', 403)
    codes.delete(key)
    const token = randomBytes(32).toString('base64url')
    tokens.set(hash(token), { extensionId, createdAt: new Date().toISOString() })
    return token
}

export function assertExtensionPaired(request: Request) {
    const origin = request.headers.get('origin') || ''
    if (!origin.startsWith('chrome-extension://')) return
    const extensionId = new URL(origin).hostname
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
    const record = tokens.get(hash(token))
    if (!record || record.extensionId !== extensionId) throw new SafeRequestError('Extension pairing required.', 401)
    const a = Buffer.from(record.extensionId)
    const b = Buffer.from(extensionId)
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new SafeRequestError('Extension pairing required.', 401)
}
