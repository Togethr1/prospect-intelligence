const LOOPBACK_AUTHORITIES = new Set([
    'localhost:5178',
    '127.0.0.1:5178',
    '[::1]:5178',
])
const DASHBOARD_ORIGINS = new Set([
    'http://localhost:5178',
    'http://127.0.0.1:5178',
    'http://[::1]:5178',
])

export const LIMITS = {
    jsonBytes: 256_000,
    messageChars: 4_000,
    messages: 40,
    pageTextChars: 40_000,
    uploadBytes: 5 * 1024 * 1024,
} as const

export class SafeRequestError extends Error {
    constructor(message: string, public readonly status = 400) {
        super(message)
    }
}

export function isExtensionRequest(request: Request) {
    const origin = request.headers.get('origin')
    if (!origin) return false
    try {
        return new URL(origin).protocol === 'chrome-extension:'
    } catch {
        return false
    }
}

export function assertLocalRequest(request: Request) {
    const authority = (request.headers.get('host') || '').trim().toLowerCase()
    if (!LOOPBACK_AUTHORITIES.has(authority)) {
        throw new SafeRequestError('This application is intentionally local-only.', 403)
    }

    const origin = request.headers.get('origin')
    if (!origin) return

    let originUrl: URL
    try {
        originUrl = new URL(origin)
    } catch {
        throw new SafeRequestError('Invalid request origin.', 403)
    }

    const isExtension = originUrl.protocol === 'chrome-extension:'
    if (!DASHBOARD_ORIGINS.has(originUrl.origin) && !isExtension) {
        throw new SafeRequestError('Cross-origin request rejected.', 403)
    }
}

export function assertDashboardRequest(request: Request) {
    assertLocalRequest(request)
    if (isExtensionRequest(request)) {
        throw new SafeRequestError('Extensions cannot access dashboard settings.', 403)
    }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
    assertLocalRequest(request)
    const declaredLength = Number(request.headers.get('content-length') || '0')
    if (declaredLength > LIMITS.jsonBytes) {
        throw new SafeRequestError('Request is too large.', 413)
    }

    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > LIMITS.jsonBytes) {
        throw new SafeRequestError('Request is too large.', 413)
    }

    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        throw new SafeRequestError('Invalid JSON.', 400)
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new SafeRequestError('Expected a JSON object.', 400)
    }
    return parsed as Record<string, unknown>
}

export function publicError(error: unknown) {
    if (error instanceof SafeRequestError) {
        return { message: error.message, status: error.status }
    }
    console.error('Request failed:', error)
    return { message: 'Unexpected local application error.', status: 500 }
}

export function cleanText(value: unknown, max: number): string {
    return typeof value === 'string'
        ? value.replace(/\u0000/g, '').trim().slice(0, max)
        : ''
}
