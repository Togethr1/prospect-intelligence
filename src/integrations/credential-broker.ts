import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { getIntegration, INTEGRATIONS } from './registry'
import type { IntegrationSummary } from './types'

interface StoredCredential {
    value: string
    fingerprint: string
    connectedAt: string
}

interface EncryptedCredentialFile {
    version: 1
    iv: string
    tag: string
    ciphertext: string
}

const DATA_DIR = path.join(process.cwd(), 'data')
const KEY_FILE = path.join(DATA_DIR, '.credential-key')
const CREDENTIAL_FILE = path.join(DATA_DIR, 'credentials.enc.json')

function ensureDataDirectory() {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 })
    fs.chmodSync(DATA_DIR, 0o700)
}

function getEncryptionKey() {
    ensureDataDirectory()
    if (!fs.existsSync(KEY_FILE)) {
        fs.writeFileSync(KEY_FILE, randomBytes(32), { mode: 0o600, flag: 'wx' })
    }
    fs.chmodSync(KEY_FILE, 0o600)
    const key = fs.readFileSync(KEY_FILE)
    if (key.length !== 32) throw new Error('The local credential encryption key is invalid.')
    return key
}

function readCredentials() {
    if (!fs.existsSync(CREDENTIAL_FILE)) return new Map<string, StoredCredential>()
    try {
        const payload = JSON.parse(fs.readFileSync(CREDENTIAL_FILE, 'utf8')) as EncryptedCredentialFile
        if (payload.version !== 1) throw new Error('Unsupported credential store version.')
        const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(payload.iv, 'base64'))
        decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
        const plaintext = Buffer.concat([
            decipher.update(Buffer.from(payload.ciphertext, 'base64')),
            decipher.final(),
        ])
        const entries = JSON.parse(plaintext.toString('utf8')) as Array<[string, StoredCredential]>
        plaintext.fill(0)
        return new Map(entries)
    } catch (error) {
        throw new Error('Encrypted credentials could not be read. Disconnect the affected integration or restore the local credential files.', { cause: error })
    }
}

function writeCredentials(credentials: Map<string, StoredCredential>) {
    ensureDataDirectory()
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
    const plaintext = Buffer.from(JSON.stringify([...credentials.entries()]), 'utf8')
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
    plaintext.fill(0)
    const payload: EncryptedCredentialFile = {
        version: 1,
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        ciphertext: ciphertext.toString('base64'),
    }
    const temporaryFile = `${CREDENTIAL_FILE}.${randomBytes(12).toString('hex')}.tmp`
    try {
        fs.writeFileSync(temporaryFile, JSON.stringify(payload), { mode: 0o600, flag: 'wx' })
        fs.renameSync(temporaryFile, CREDENTIAL_FILE)
        fs.chmodSync(CREDENTIAL_FILE, 0o600)
    } finally {
        try {
            fs.unlinkSync(temporaryFile)
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
    }
}

export function storeCredential(providerId: string, value: string) {
    const provider = getIntegration(providerId)
    if (!provider || (!provider.available && !provider.credentialConfigurable)) {
        throw new Error('This integration does not accept credentials.')
    }
    if (value.length < 12 || value.length > 4_096) throw new Error('Credential length is invalid.')
    const fingerprint = createHash('sha256').update(value).digest('hex').slice(-8).toUpperCase()
    const credentials = readCredentials()
    credentials.set(providerId, { value, fingerprint, connectedAt: new Date().toISOString() })
    writeCredentials(credentials)
}

export function deleteCredential(providerId: string) {
    const credentials = readCredentials()
    credentials.delete(providerId)
    writeCredentials(credentials)
}

export function getCredential(providerId: string) {
    return readCredentials().get(providerId)?.value
}

export function listIntegrationSummaries(): IntegrationSummary[] {
    const credentials = readCredentials()
    return INTEGRATIONS.map((provider) => {
        const stored = credentials.get(provider.id)
        return {
            ...provider,
            status: stored ? 'connected' : 'disconnected',
            fingerprint: stored?.fingerprint,
            connectedAt: stored?.connectedAt,
        }
    })
}
