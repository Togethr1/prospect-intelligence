export async function providerJson(
    url: string,
    init: RequestInit,
    providerName: string,
): Promise<Record<string, unknown>> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12_000)
    try {
        const response = await fetch(url, {
            ...init,
            signal: controller.signal,
            redirect: 'error',
            cache: 'no-store',
        })
        const text = (await response.text()).slice(0, 1_000_000)
        let data: unknown
        try {
            data = JSON.parse(text)
        } catch {
            throw new Error(`${providerName} returned an invalid response.`)
        }
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error(`${providerName} rejected the credential or account permissions.`)
            }
            if (response.status === 402 || response.status === 429) {
                throw new Error(`${providerName} reported a credit, quota, or rate limit.`)
            }
            throw new Error(`${providerName} could not complete the lookup.`)
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

export function object(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
}

export function text(value: unknown, max = 500) {
    return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function number(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
