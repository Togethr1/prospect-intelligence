const blockedNames = new Set([
    'localhost',
    'localhost.localdomain',
])

function isPrivateIpv4(hostname: string) {
    const parts = hostname.split('.')
    if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false
    const values = parts.map(Number)
    if (values.some((value) => value > 255)) return true
    const [a, b] = values
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 0 || b === 168)) ||
        (a === 198 && (b === 18 || b === 19)) ||
        a >= 224
    )
}

export function isPublicPageUrl(value: string) {
    let url: URL
    try {
        url = new URL(value)
    } catch {
        return false
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false
    if (url.port && !['80', '443'].includes(url.port)) return false

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
    if (
        !hostname ||
        blockedNames.has(hostname) ||
        !hostname.includes('.') ||
        hostname.includes(':') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.test') ||
        hostname.endsWith('.invalid') ||
        hostname.endsWith('.example') ||
        isPrivateIpv4(hostname)
    ) {
        return false
    }
    return true
}
