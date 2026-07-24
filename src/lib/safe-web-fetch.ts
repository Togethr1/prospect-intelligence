import dns from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import type { LookupFunction } from 'node:net'

const MAX_REDIRECTS = 4
const MAX_HTML_BYTES = 1_500_000
const REQUEST_TIMEOUT_MS = 12_000
const ALLOWED_PORTS = new Set(['', '80', '443'])

const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    'localhost.localdomain',
    'metadata.google.internal',
    'metadata.aws.internal',
])

const blockedAddresses = new net.BlockList()
for (const [network, prefix, type] of [
    ['0.0.0.0', 8, 'ipv4'],
    ['10.0.0.0', 8, 'ipv4'],
    ['100.64.0.0', 10, 'ipv4'],
    ['127.0.0.0', 8, 'ipv4'],
    ['169.254.0.0', 16, 'ipv4'],
    ['172.16.0.0', 12, 'ipv4'],
    ['192.0.0.0', 24, 'ipv4'],
    ['192.0.2.0', 24, 'ipv4'],
    ['192.88.99.0', 24, 'ipv4'],
    ['192.168.0.0', 16, 'ipv4'],
    ['198.18.0.0', 15, 'ipv4'],
    ['198.51.100.0', 24, 'ipv4'],
    ['203.0.113.0', 24, 'ipv4'],
    ['224.0.0.0', 4, 'ipv4'],
    ['240.0.0.0', 4, 'ipv4'],
    ['::', 128, 'ipv6'],
    ['::1', 128, 'ipv6'],
    ['64:ff9b:1::', 48, 'ipv6'],
    ['100::', 64, 'ipv6'],
    ['2001:db8::', 32, 'ipv6'],
    ['2001:20::', 28, 'ipv6'],
    ['2002::', 16, 'ipv6'],
    ['fc00::', 7, 'ipv6'],
    ['fe80::', 10, 'ipv6'],
    ['ff00::', 8, 'ipv6'],
] as const) {
    blockedAddresses.addSubnet(network, prefix, type)
}

export function isPrivateAddress(address: string) {
    const normalized = address.toLowerCase().split('%')[0]
    if (net.isIPv4(normalized)) return blockedAddresses.check(normalized, 'ipv4')
    if (net.isIPv6(normalized)) {
        if (normalized.startsWith('::ffff:')) return true
        return blockedAddresses.check(normalized, 'ipv6')
    }
    return true
}

export function normalizePublicUrl(value: string, base?: URL) {
    let parsed: URL
    try {
        parsed = base ? new URL(value, base) : new URL(value)
    } catch {
        throw new Error('Enter a valid website URL.')
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only public HTTP and HTTPS websites can be analyzed.')
    }
    if (parsed.username || parsed.password || !ALLOWED_PORTS.has(parsed.port)) {
        throw new Error('Credentials and custom ports are not allowed in website URLs.')
    }
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '')
    if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local')) {
        throw new Error('Local and private network addresses cannot be analyzed.')
    }
    parsed.hash = ''
    return parsed
}

async function resolvePublicAddress(hostname: string) {
    if (net.isIP(hostname)) {
        if (isPrivateAddress(hostname)) throw new Error('Local and private network addresses cannot be analyzed.')
        return { address: hostname, family: net.isIPv6(hostname) ? 6 : 4 }
    }
    let records: Array<{ address: string; family: number }>
    try {
        records = await dns.lookup(hostname, { all: true, verbatim: true })
    } catch {
        throw new Error('The website hostname could not be resolved.')
    }
    if (!records.length || records.some((record) => isPrivateAddress(record.address))) {
        throw new Error('The website resolves to a local, private, or unsupported network address.')
    }
    return records[0]
}

function pinnedLookup(address: string, family: number): LookupFunction {
    return ((hostname, options, callback) => {
        void hostname
        if (typeof options === 'object' && options.all) {
            callback(null, [{ address, family }])
            return
        }
        callback(null, address, family)
    }) as LookupFunction
}

function fetchOnce(url: URL, address: string, family: number) {
    return new Promise<{ status: number; location?: string; contentType: string; html: string }>((resolve, reject) => {
        const client = url.protocol === 'https:' ? https : http
        const request = client.request(url, {
            method: 'GET',
            lookup: pinnedLookup(address, family),
            servername: url.hostname,
            headers: {
                accept: 'text/html,application/xhtml+xml;q=0.9',
                'accept-encoding': 'identity',
                'user-agent': 'ProspectIntelligence/1.0 (+local open-source research tool)',
            },
        }, (response) => {
            const status = response.statusCode || 0
            const location = response.headers.location
            const contentType = String(response.headers['content-type'] || '').toLowerCase()
            const contentEncoding = String(response.headers['content-encoding'] || 'identity').toLowerCase()

            if (status >= 300 && status < 400 && location) {
                response.resume()
                resolve({ status, location, contentType, html: '' })
                return
            }
            if (status < 200 || status >= 300) {
                response.resume()
                reject(new Error(`The website returned HTTP ${status || 'an invalid response'}.`))
                return
            }
            if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
                response.resume()
                reject(new Error('The URL did not return an HTML webpage.'))
                return
            }
            if (contentEncoding && contentEncoding !== 'identity') {
                response.resume()
                reject(new Error('The website returned an unsupported compressed response.'))
                return
            }

            const chunks: Buffer[] = []
            let total = 0
            response.on('data', (chunk: Buffer) => {
                total += chunk.length
                if (total > MAX_HTML_BYTES) {
                    request.destroy(new Error('The webpage is too large to analyze safely.'))
                    return
                }
                chunks.push(chunk)
            })
            response.on('end', () => resolve({
                status,
                contentType,
                html: Buffer.concat(chunks).toString('utf8'),
            }))
        })
        request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('The website took too long to respond.')))
        request.on('error', (error) => {
            const safeMessages = [
                'The webpage is too large to analyze safely.',
                'The website took too long to respond.',
            ]
            reject(new Error(safeMessages.includes(error.message) ? error.message : 'Could not connect to the website.'))
        })
        request.end()
    })
}

function decodeEntities(value: string) {
    const named: Record<string, string> = {
        amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
    }
    return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
        const numeric = entity.startsWith('#x')
            ? Number.parseInt(entity.slice(2), 16)
            : entity.startsWith('#') ? Number.parseInt(entity.slice(1), 10) : null
        if (numeric !== null) {
            return Number.isFinite(numeric) && numeric >= 0 && numeric <= 0x10ffff
                ? String.fromCodePoint(numeric)
                : match
        }
        return named[entity.toLowerCase()] ?? match
    })
}

function extractPage(html: string, finalUrl: URL) {
    const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
    const descriptionMatch = html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)
        ?? html.match(/<meta\b[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i)
    const withoutNoise = html
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(script|style|noscript|svg|canvas|template)\b[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<\/(p|div|section|article|main|header|footer|li|h[1-6]|br)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
    const pageText = decodeEntities(`${descriptionMatch?.[1] || ''}\n${withoutNoise}`)
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 40_000)
    const title = decodeEntities(titleMatch?.[1] || finalUrl.hostname)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300)
    if (pageText.length < 50) {
        throw new Error('The site did not expose enough readable HTML. It may require JavaScript or block automated access.')
    }
    return { pageText, title }
}

export async function fetchPublicWebpage(input: string) {
    let current = normalizePublicUrl(input)
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
        const resolved = await resolvePublicAddress(current.hostname)
        const result = await fetchOnce(current, resolved.address, resolved.family)
        if (result.location) {
            if (redirects === MAX_REDIRECTS) throw new Error('The website redirected too many times.')
            current = normalizePublicUrl(result.location, current)
            continue
        }
        return { ...extractPage(result.html, current), finalUrl: current.toString() }
    }
    throw new Error('The website could not be retrieved.')
}
