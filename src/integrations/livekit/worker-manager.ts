import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { LiveKitCredentials } from './config'

interface WorkerState {
    process?: ChildProcess
    fingerprint?: string
    ready?: Promise<void>
}

const globalWorker = globalThis as typeof globalThis & { __roleplayWorker?: WorkerState }
const state = globalWorker.__roleplayWorker ?? {}
globalWorker.__roleplayWorker = state

function credentialFingerprint(credentials: LiveKitCredentials) {
    return createHash('sha256')
        .update(`${credentials.url}\u0000${credentials.apiKey}\u0000${credentials.apiSecret}`)
        .digest('hex')
}

export async function ensureRoleplayWorker(credentials: LiveKitCredentials) {
    const fingerprint = credentialFingerprint(credentials)
    if (state.process && !state.process.killed && state.fingerprint === fingerprint && state.ready) {
        await state.ready
        return
    }
    if (state.process && !state.process.killed) state.process.kill('SIGTERM')

    const entrypoint = path.join(process.cwd(), 'agent', 'main.ts')
    const child = spawn(process.execPath, ['--import', 'tsx', entrypoint, 'start'], {
        cwd: process.cwd(),
        env: {
            NODE_ENV: process.env.NODE_ENV || 'production',
            PATH: process.env.PATH,
            TMPDIR: process.env.TMPDIR,
            LIVEKIT_URL: credentials.url,
            LIVEKIT_API_KEY: credentials.apiKey,
            LIVEKIT_API_SECRET: credentials.apiSecret,
            LIVEKIT_AGENT_NAME: 'prospect-roleplay',
            LIVEKIT_LOG_LEVEL: 'info',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    })
    state.process = child
    state.fingerprint = fingerprint
    state.ready = new Promise<void>((resolve, reject) => {
        let settled = false
        let output = ''
        const timer = setTimeout(() => {
            if (settled) return
            settled = true
            child.kill('SIGTERM')
            reject(new Error('The local LiveKit worker did not become ready in time.'))
        }, 15_000)
        const onData = (chunk: Buffer) => {
            const message = chunk.toString('utf8')
            output = `${output}${message}`.slice(-4_000)
            if (!settled && /registered worker|worker registered/i.test(output)) {
                settled = true
                clearTimeout(timer)
                resolve()
            }
        }
        child.stdout?.on('data', onData)
        child.stderr?.on('data', onData)
        child.once('exit', (code) => {
            state.process = undefined
            if (settled) return
            settled = true
            clearTimeout(timer)
            reject(new Error(`The local LiveKit worker stopped before connecting${code === null ? '.' : ` (code ${code}).`}`))
        })
    })
    await state.ready
}

export function stopRoleplayWorker() {
    if (state.process && !state.process.killed) state.process.kill('SIGTERM')
    state.process = undefined
    state.fingerprint = undefined
    state.ready = undefined
}
