import assert from 'node:assert/strict'
import test from 'node:test'
import {
    assertDashboardRequest,
    assertLocalRequest,
    cleanText,
    isExtensionRequest,
    readJsonObject,
    SafeRequestError,
} from '../src/lib/security'
import { isPrivateAddress, normalizePublicUrl } from '../src/lib/safe-web-fetch'
import { parseLiveKitCredential } from '../src/integrations/livekit/config'
import { httpUrl } from '../src/integrations/intelligence/provider-http'
import { isPublicPageUrl } from '../extension/src/lib/public-page'
import { personaInputSchema } from '../src/lib/persona-validation'
import { enforceRateLimit } from '../src/lib/rate-limit'

function request(origin?: string, host = 'localhost:5178') {
    const headers = new Headers({ host })
    if (origin) headers.set('origin', origin)
    return new Request('http://localhost:5178/api/test', { headers })
}

test('local request boundary accepts only the dashboard origins and extensions', () => {
    assert.doesNotThrow(() => assertLocalRequest(request()))
    assert.doesNotThrow(() => assertLocalRequest(request(undefined, '[::1]:5178')))
    assert.doesNotThrow(() => assertLocalRequest(request('http://localhost:5178')))
    assert.doesNotThrow(() => assertLocalRequest(request('http://127.0.0.1:5178')))
    assert.doesNotThrow(() => assertLocalRequest(request('http://[::1]:5178')))
    assert.doesNotThrow(() => assertLocalRequest(request(`chrome-extension://${'a'.repeat(32)}`)))

    assert.throws(
        () => assertLocalRequest(request('http://localhost:3000')),
        (error) => error instanceof SafeRequestError && error.status === 403,
    )
    assert.throws(
        () => assertLocalRequest(request('https://attacker.example')),
        (error) => error instanceof SafeRequestError && error.status === 403,
    )
    assert.throws(
        () => assertLocalRequest(request(undefined, 'attacker.example')),
        (error) => error instanceof SafeRequestError && error.status === 403,
    )
    assert.throws(
        () => assertLocalRequest(request(undefined, 'localhost:3000')),
        (error) => error instanceof SafeRequestError && error.status === 403,
    )
})

test('dashboard-only boundary rejects extension callers', () => {
    const extension = request(`chrome-extension://${'a'.repeat(32)}`)
    assert.equal(isExtensionRequest(extension), true)
    assert.throws(
        () => assertDashboardRequest(extension),
        (error) => error instanceof SafeRequestError && error.status === 403,
    )
})

test('private and special-purpose network addresses are rejected', () => {
    for (const address of [
        '0.0.0.0',
        '10.1.2.3',
        '127.0.0.1',
        '169.254.169.254',
        '172.16.0.1',
        '192.168.1.1',
        '198.51.100.7',
        '::',
        '::1',
        '::ffff:127.0.0.1',
        '::ffff:7f00:1',
        'fc00::1',
        'fe80::1',
        '2001:db8::1',
    ]) {
        assert.equal(isPrivateAddress(address), true, address)
    }
    assert.equal(isPrivateAddress('1.1.1.1'), false)
    assert.equal(isPrivateAddress('2606:4700:4700::1111'), false)
})

test('public URL normalization rejects unsafe URL forms', () => {
    assert.equal(normalizePublicUrl('https://example.com/path#fragment').toString(), 'https://example.com/path')
    assert.throws(() => normalizePublicUrl('file:///etc/passwd'))
    assert.throws(() => normalizePublicUrl('https://user:pass@example.com'))
    assert.throws(() => normalizePublicUrl('https://example.com:8443'))
    assert.throws(() => normalizePublicUrl('http://localhost'))
    assert.throws(() => normalizePublicUrl('http://printer.local'))
})

test('extension page analysis rejects internal and special-purpose URLs', () => {
    assert.equal(isPublicPageUrl('https://example.com/company'), true)
    assert.equal(isPublicPageUrl('http://localhost:5178'), false)
    assert.equal(isPublicPageUrl('http://127.0.0.1'), false)
    assert.equal(isPublicPageUrl('https://printer.local'), false)
    assert.equal(isPublicPageUrl('https://single-label'), false)
    assert.equal(isPublicPageUrl('https://example.com:8443'), false)
    assert.equal(isPublicPageUrl('file:///etc/passwd'), false)
})

test('cleanText strips nulls, trims, and enforces a character cap', () => {
    assert.equal(cleanText('  ab\u0000cdef  ', 5), 'abcde')
    assert.equal(cleanText({ value: 'secret' }, 20), '')
})

test('provider URLs retain only HTTP and HTTPS links', () => {
    assert.equal(httpUrl('https://example.com/path'), 'https://example.com/path')
    assert.equal(httpUrl('http://example.com'), 'http://example.com/')
    assert.equal(httpUrl('https://user:pass@example.com'), '')
    assert.equal(httpUrl('javascript:alert(1)'), '')
    assert.equal(httpUrl('data:text/html,unsafe'), '')
    assert.equal(httpUrl('not a URL'), '')
})

test('JSON requests must be bounded object payloads', async () => {
    const headers = { host: 'localhost:5178', 'content-type': 'application/json' }
    await assert.rejects(() => readJsonObject(new Request('http://localhost:5178/api/test', {
        method: 'POST',
        headers,
        body: '[]',
    })), (error) => error instanceof SafeRequestError && error.status === 400)
    await assert.rejects(() => readJsonObject(new Request('http://localhost:5178/api/test', {
        method: 'POST',
        headers: { ...headers, 'content-length': '999999' },
        body: '{}',
    })), (error) => error instanceof SafeRequestError && error.status === 413)
})

test('persona input rejects unknown fields and oversized arrays', () => {
    const valid = {
        name: 'Morgan Lee',
        jobTitle: 'VP of Sales',
        industry: 'Software',
        scenario: 'First call',
        personalityType: 'Analytical',
        keyObjections: ['No budget'],
        buyingCriteria: ['Fast implementation'],
        voiceGender: 'woman' as const,
        voiceTone: 'professional',
    }
    assert.equal(personaInputSchema.parse(valid).name, valid.name)
    assert.throws(() => personaInputSchema.parse({ ...valid, unexpected: 'field' }))
    assert.throws(() => personaInputSchema.parse({
        ...valid,
        keyObjections: Array.from({ length: 21 }, () => 'No budget'),
    }))
})

test('explicit-run rate limits fail closed after the configured maximum', () => {
    const key = `test:${crypto.randomUUID()}`
    assert.doesNotThrow(() => enforceRateLimit(key, 2, 60_000))
    assert.doesNotThrow(() => enforceRateLimit(key, 2, 60_000))
    assert.throws(
        () => enforceRateLimit(key, 2, 60_000),
        (error) => error instanceof SafeRequestError && error.status === 429,
    )
})

test('LiveKit credentials are restricted to LiveKit Cloud project URLs', () => {
    const credential = (url: string) => JSON.stringify({
        url,
        apiKey: 'A'.repeat(12),
        apiSecret: 'B'.repeat(32),
    })
    assert.equal(
        parseLiveKitCredential(credential('wss://portfolio-123.livekit.cloud')).url,
        'wss://portfolio-123.livekit.cloud',
    )
    assert.throws(() => parseLiveKitCredential(credential('wss://127.0.0.1')))
    assert.throws(() => parseLiveKitCredential(credential('wss://livekit.cloud.attacker.example')))
    assert.throws(() => parseLiveKitCredential(credential('wss://project.livekit.cloud:8443')))
    assert.throws(() => parseLiveKitCredential(credential('wss://project.livekit.cloud/path')))
})
