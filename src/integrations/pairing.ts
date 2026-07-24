import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/local-db'
import { SafeRequestError } from '@/lib/security'

interface PendingApproval {
    id: string
    extensionId: string
    createdAt: string
    expiresAt: number
    approvedToken?: string
}

const pairingGlobal = globalThis as typeof globalThis & {
    __pendingExtensionApprovals?: Map<string, PendingApproval>
}
const pending = pairingGlobal.__pendingExtensionApprovals ?? new Map<string, PendingApproval>()
pairingGlobal.__pendingExtensionApprovals = pending

const hash = (value: string) => createHash('sha256').update(value).digest('hex')

function prunePending() {
    const now = Date.now()
    for (const [id, request] of pending) {
        if (request.expiresAt < now) pending.delete(id)
    }
}

function extensionIdFromRequest(request: Request) {
    const origin = request.headers.get('origin') || ''
    if (!origin.startsWith('chrome-extension://')) {
        throw new SafeRequestError('This action must come from a Chrome extension.', 403)
    }
    const extensionId = new URL(origin).hostname
    if (!/^[a-p]{32}$/.test(extensionId)) {
        throw new SafeRequestError('Invalid Chrome extension identity.', 403)
    }
    return extensionId
}

export function requestExtensionApproval(request: Request) {
    prunePending()
    const extensionId = extensionIdFromRequest(request)
    const existing = [...pending.values()].find((item) => item.extensionId === extensionId)
    if (existing) {
        existing.expiresAt = Date.now() + 5 * 60_000
        return { requestId: existing.id, expiresAt: new Date(existing.expiresAt).toISOString() }
    }
    if (pending.size >= 10) throw new SafeRequestError('Too many pending extension requests. Try again shortly.', 429)
    const id = randomBytes(18).toString('base64url')
    const record: PendingApproval = {
        id,
        extensionId,
        createdAt: new Date().toISOString(),
        expiresAt: Date.now() + 5 * 60_000,
    }
    pending.set(id, record)
    return { requestId: id, expiresAt: new Date(record.expiresAt).toISOString() }
}

export function listExtensionPairingState() {
    prunePending()
    return {
        pending: [...pending.values()]
            .filter((item) => !item.approvedToken)
            .map((item) => ({
                id: item.id,
                extensionId: item.extensionId,
                createdAt: item.createdAt,
                expiresAt: new Date(item.expiresAt).toISOString(),
            })),
        approved: db.getPairedExtensions().map((item) => ({
            id: item.id,
            extensionId: item.extension_id,
            createdAt: item.created_at,
        })),
    }
}

export function approveExtension(requestId: string) {
    prunePending()
    const record = pending.get(requestId)
    if (!record) throw new SafeRequestError('Extension request is invalid or expired.', 404)
    const token = randomBytes(32).toString('base64url')
    db.savePairedExtension(record.extensionId, hash(token))
    record.approvedToken = token
    return { approved: true }
}

export function claimExtensionApproval(request: Request, requestId: string) {
    prunePending()
    const extensionId = extensionIdFromRequest(request)
    const record = pending.get(requestId)
    if (!record || record.extensionId !== extensionId) {
        throw new SafeRequestError('Extension request is invalid or expired.', 404)
    }
    if (!record.approvedToken) return { status: 'pending' as const }
    const token = record.approvedToken
    pending.delete(requestId)
    return { status: 'approved' as const, token }
}

export function revokeExtension(id: string) {
    db.deletePairedExtension(id)
}

export function assertExtensionPaired(request: Request) {
    const origin = request.headers.get('origin') || ''
    if (!origin.startsWith('chrome-extension://')) return
    const extensionId = extensionIdFromRequest(request)
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
    if (token.length < 32) throw new SafeRequestError('Extension approval required.', 401)
    const record = db.getPairedExtensionByTokenHash(hash(token))
    if (!record) throw new SafeRequestError('Extension approval required.', 401)
    const a = Buffer.from(record.extension_id)
    const b = Buffer.from(extensionId)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new SafeRequestError('Extension approval required.', 401)
    }
}
