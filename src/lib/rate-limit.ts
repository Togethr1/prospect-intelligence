import { SafeRequestError } from './security'

interface WindowState {
    startedAt: number
    count: number
}

const rateLimitGlobal = globalThis as typeof globalThis & {
    __localRateLimits?: Map<string, WindowState>
}
const windows = rateLimitGlobal.__localRateLimits ?? new Map<string, WindowState>()
rateLimitGlobal.__localRateLimits = windows

export function enforceRateLimit(key: string, maximum: number, windowMs: number) {
    const now = Date.now()
    const current = windows.get(key)
    if (!current || now - current.startedAt >= windowMs) {
        windows.set(key, { startedAt: now, count: 1 })
        return
    }
    if (current.count >= maximum) {
        throw new SafeRequestError('Too many requests. Wait briefly and try again.', 429)
    }
    current.count += 1

    if (windows.size > 100) {
        for (const [storedKey, state] of windows) {
            if (now - state.startedAt >= windowMs) windows.delete(storedKey)
        }
    }
}
