export async function providerJson(
    url: string,
    init: RequestInit,
    providerName: string,
    timeoutMs = 12_000,
): Promise<Record<string, unknown>> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const response = await fetch(url, {
            ...init,
            signal: controller.signal,
            redirect: 'error',
            cache: 'no-store',
        })
        if (response.status === 204) return {}
        if (!response.ok) {
            await response.body?.cancel().catch(() => undefined)
            if (response.status === 401 || response.status === 403) {
                throw new Error(`${providerName} rejected the credential or account permissions.`)
            }
            if (response.status === 402 || response.status === 429) {
                throw new Error(`${providerName} reported a credit, quota, or rate limit.`)
            }
            throw new Error(`${providerName} could not complete the lookup.`)
        }
        const text = await readResponseText(response, 1_000_000, providerName)
        let data: unknown
        try {
            data = JSON.parse(text)
        } catch {
            throw new Error(`${providerName} returned an invalid response.`)
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error(`${providerName} returned an invalid response.`)
        }
        return data as Record<string, unknown>
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`${providerName} timed out.`)
        }
        throw error
    } finally {
        clearTimeout(timer)
    }
}

async function readResponseText(response: Response, maxBytes: number, providerName: string) {
    const declaredLength = Number(response.headers.get('content-length') || '0')
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        await response.body?.cancel().catch(() => undefined)
        throw new Error(`${providerName} returned an oversized response.`)
    }
    if (!response.body) return ''

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            total += value.byteLength
            if (total > maxBytes) {
                await reader.cancel()
                throw new Error(`${providerName} returned an oversized response.`)
            }
            chunks.push(value)
        }
    } finally {
        reader.releaseLock()
    }
    const combined = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.byteLength
    }
    return new TextDecoder().decode(combined)
}

export function object(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
}

export function text(value: unknown, max = 500) {
    return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function httpUrl(value: unknown, max = 2_000) {
    const raw = text(value, max)
    if (!raw) return ''
    try {
        const parsed = new URL(raw)
        if (
            (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
            parsed.username ||
            parsed.password
        ) {
            return ''
        }
        return parsed.toString()
    } catch {
        return ''
    }
}

export function number(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
