import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    AlertCircle, AudioLines, BookOpen, CheckCircle2, Copy, Database,
    ExternalLink, Lightbulb, Mic, MicOff, Radio, Settings2, ShieldCheck, Sparkles,
} from 'lucide-react'
import {
    getLocalContext,
    getTranscriptionStatus,
    listAiProviders,
    requestTranscriptionSession,
    runAiProvider,
    type IntelligenceProvider,
    type LocalContext,
    type TranscriptionStatus,
} from '../services/local'

type TranscriptMode = 'browser' | 'assemblyai'
type SpeechRecognitionInstance = {
    continuous: boolean
    interimResults: boolean
    lang: string
    start: () => void
    stop: () => void
    abort: () => void
    onresult: ((event: {
        resultIndex: number
        results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>
    }) => void) | null
    onerror: ((event: { error: string }) => void) | null
    onend: (() => void) | null
}

type Suggestion = {
    id: string
    label: 'Local match' | 'AI coach'
    content: string
}

const SpeechRecognitionConstructor = (
    window as typeof window & {
        SpeechRecognition?: new () => SpeechRecognitionInstance
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance
    }
).SpeechRecognition || (
    window as typeof window & {
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance
    }
).webkitSpeechRecognition

function downsampleToPcm16(input: Float32Array, inputRate: number, outputRate = 16_000) {
    if (outputRate > inputRate) throw new Error('Microphone sample rate is lower than 16 kHz.')
    const ratio = inputRate / outputRate
    const output = new Int16Array(Math.floor(input.length / ratio))
    for (let index = 0; index < output.length; index += 1) {
        const start = Math.floor(index * ratio)
        const end = Math.min(Math.floor((index + 1) * ratio), input.length)
        let sum = 0
        for (let cursor = start; cursor < end; cursor += 1) sum += input[cursor]
        const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)))
        output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    }
    return output.buffer
}

function localMatch(text: string, context: LocalContext | null, personaId: string): string | null {
    if (!context) return null
    const normalized = text.toLowerCase()
    const persona = context.personas.find((item) => item.id === personaId) || context.personas[0]
    const objections = persona?.personality_config.keyObjections || []
    const match = objections.find((objection) => {
        const terms = objection.toLowerCase().split(/\W+/).filter((term) => term.length > 4)
        return terms.some((term) => normalized.includes(term))
    })
    if (!match) return null
    const criterion = persona?.personality_config.buyingCriteria?.[0]
    return [
        `Likely objection: “${match}”`,
        criterion ? `Anchor the response to: ${criterion}` : '',
        'Acknowledge the concern, ask one clarifying question, then respond with the most relevant proof point.',
    ].filter(Boolean).join('\n')
}

function compactContext(context: LocalContext | null, personaId: string, researchId: string) {
    if (!context) return 'No saved local context is available.'
    const persona = context.personas.find((item) => item.id === personaId) || context.personas[0]
    const research = context.researchRecords.find((item) => item.id === researchId) || context.researchRecords[0]
    const knowledge = context.knowledgeItems.slice(0, 10).map((item) =>
        `[${item.metadata?.title || item.metadata?.type || 'Knowledge'}] ${item.content.slice(0, 700)}`
    ).join('\n')
    return [
        persona ? `ACTIVE PERSONA: ${persona.name}\n${JSON.stringify(persona.personality_config)}` : '',
        research ? `RECENT PROSPECT RESEARCH: ${research.title} (${research.url})\n${JSON.stringify(research.sales_assets).slice(0, 8_000)}\nCRM: ${JSON.stringify(research.crm_context || {}).slice(0, 2_000)}` : '',
        knowledge ? `SELLER KNOWLEDGE, TALK TRACKS, ICP, AND OBJECTION HANDLES:\n${knowledge}` : '',
    ].filter(Boolean).join('\n\n').slice(0, 20_000)
}

export function LiveView({ paired, onOpenConnection }: { paired: boolean; onOpenConnection: () => void }) {
    const [context, setContext] = useState<LocalContext | null>(null)
    const [providers, setProviders] = useState<IntelligenceProvider[]>([])
    const [providersLoaded, setProvidersLoaded] = useState(false)
    const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionStatus | null>(null)
    const [providerId, setProviderId] = useState('')
    const [personaId, setPersonaId] = useState('')
    const [researchId, setResearchId] = useState('')
    const [mode, setMode] = useState<TranscriptMode>('browser')
    const [aiCoaching, setAiCoaching] = useState(true)
    const [isListening, setIsListening] = useState(false)
    const [isStarting, setIsStarting] = useState(false)
    const [interim, setInterim] = useState('')
    const [transcript, setTranscript] = useState<string[]>([])
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [error, setError] = useState('')
    const [status, setStatus] = useState('Loading local context…')

    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
    const webSocketRef = useRef<WebSocket | null>(null)
    const mediaStreamRef = useRef<MediaStream | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const processorRef = useRef<ScriptProcessorNode | null>(null)
    const lastAiAtRef = useRef(0)
    const transcriptRef = useRef<string[]>([])

    const selectedProvider = providers.find((provider) => provider.id === providerId)
    const contextCounts = useMemo(() => ({
        knowledge: context?.knowledgeItems.length || 0,
        personas: context?.personas.length || 0,
        research: context?.researchRecords.length || 0,
    }), [context])

    useEffect(() => {
        let active = true
        Promise.all([getLocalContext(), listAiProviders(), getTranscriptionStatus()])
            .then(([localContext, aiProviders, voiceStatus]) => {
                if (!active) return
                setContext(localContext)
                setProviders(aiProviders)
                setProvidersLoaded(true)
                setTranscriptionStatus(voiceStatus)
                setProviderId(aiProviders[0]?.id || '')
                setPersonaId(localContext.personas[0]?.id || '')
                setResearchId(localContext.researchRecords[0]?.id || '')
                setStatus('Ready')
            })
            .catch((caught) => {
                if (!active) return
                const message = caught instanceof Error ? caught.message : 'Could not load local context.'
                setProvidersLoaded(true)
                setStatus('')
                setError(message === 'PAIRING_REQUIRED'
                    ? 'Connect the extension to load local research and providers.'
                    : message)
            })
        return () => { active = false }
    }, [])

    const liveLocked = providersLoaded && providers.length === 0

    const generateAiSuggestion = useCallback(async (latestText: string) => {
        if (!aiCoaching || !providerId) return
        const now = Date.now()
        if (now - lastAiAtRef.current < 10_000) return
        lastAiAtRef.current = now
        const recentTranscript = [...transcriptRef.current.slice(-3), latestText].join('\n')
        const prompt = [
            'You are a real-time sales call coach. Give the rep one immediately usable response.',
            'Use only the supplied local context and transcript. Do not invent company facts.',
            'Return at most 90 words using exactly these labels: SAY:, ASK:, WATCH FOR:.',
            compactContext(context, personaId, researchId),
            `LATEST CALL TRANSCRIPT:\n${recentTranscript}`,
        ].join('\n\n').slice(0, 40_000)
        try {
            const result = await runAiProvider(providerId, prompt)
            const nextSuggestion: Suggestion = {
                id: crypto.randomUUID(),
                label: 'AI coach',
                content: result.content,
            }
            setSuggestions((current) => [nextSuggestion, ...current].slice(0, 6))
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'AI coaching could not respond.')
        }
    }, [aiCoaching, context, personaId, providerId, researchId])

    const acceptFinalTranscript = useCallback((text: string) => {
        const clean = text.replace(/\s+/g, ' ').trim()
        if (!clean) return
        transcriptRef.current = [...transcriptRef.current, clean].slice(-30)
        setTranscript(transcriptRef.current)
        setInterim('')
        const matched = localMatch(clean, context, personaId)
        if (matched) {
            const nextSuggestion: Suggestion = {
                id: crypto.randomUUID(),
                label: 'Local match',
                content: matched,
            }
            setSuggestions((current) => [nextSuggestion, ...current].slice(0, 6))
        }
        void generateAiSuggestion(clean)
    }, [context, generateAiSuggestion, personaId])

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop()
        recognitionRef.current = null
        processorRef.current?.disconnect()
        processorRef.current = null
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        void audioContextRef.current?.close()
        audioContextRef.current = null
        if (webSocketRef.current?.readyState === WebSocket.OPEN) {
            webSocketRef.current.send(JSON.stringify({ type: 'Terminate' }))
        }
        window.setTimeout(() => webSocketRef.current?.close(), 500)
        webSocketRef.current = null
        setIsListening(false)
        setInterim('')
        setStatus('Session ended')
    }, [])

    useEffect(() => stopListening, [stopListening])

    const startBrowserSpeech = useCallback(() => {
        if (!SpeechRecognitionConstructor) {
            throw new Error('Browser speech recognition is unavailable. Connect AssemblyAI for streaming transcription.')
        }
        const recognition = new SpeechRecognitionConstructor()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'
        recognition.onresult = (event) => {
            let partial = ''
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                const result = event.results[index]
                if (result.isFinal) acceptFinalTranscript(result[0].transcript)
                else partial += result[0].transcript
            }
            setInterim(partial.trim())
        }
        recognition.onerror = (event) => {
            if (event.error !== 'no-speech') setError(`Transcription error: ${event.error}`)
        }
        recognition.onend = () => {
            if (recognitionRef.current === recognition) setIsListening(false)
        }
        recognitionRef.current = recognition
        recognition.start()
        setStatus('Browser transcription active')
    }, [acceptFinalTranscript])

    const startAssemblyAi = useCallback(async () => {
        const session = await requestTranscriptionSession()
        const params = new URLSearchParams({
            token: session.token,
            sample_rate: String(session.sampleRate),
            speech_model: 'u3-rt-pro',
            format_turns: 'true',
        })
        const socket = new WebSocket(`${session.websocketUrl}?${params}`)
        socket.binaryType = 'arraybuffer'
        webSocketRef.current = socket

        await new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(() => reject(new Error('Transcription connection timed out.')), 10_000)
            socket.onopen = () => {
                window.clearTimeout(timer)
                resolve()
            }
            socket.onerror = () => {
                window.clearTimeout(timer)
                reject(new Error('AssemblyAI streaming connection failed.'))
            }
        })

        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(String(event.data)) as {
                    type?: string
                    transcript?: string
                    end_of_turn?: boolean
                }
                if (message.type !== 'Turn' || !message.transcript) return
                if (message.end_of_turn) acceptFinalTranscript(message.transcript)
                else setInterim(message.transcript)
            } catch {
                setError('A transcription message could not be read.')
            }
        }
        socket.onclose = () => setIsListening(false)

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        })
        mediaStreamRef.current = stream
        const audioContext = new AudioContext()
        audioContextRef.current = audioContext
        const source = audioContext.createMediaStreamSource(stream)
        const processor = audioContext.createScriptProcessor(4096, 1, 1)
        const silentGain = audioContext.createGain()
        silentGain.gain.value = 0
        processor.onaudioprocess = (event) => {
            if (socket.readyState !== WebSocket.OPEN) return
            socket.send(downsampleToPcm16(event.inputBuffer.getChannelData(0), audioContext.sampleRate, session.sampleRate))
        }
        source.connect(processor)
        processor.connect(silentGain)
        silentGain.connect(audioContext.destination)
        processorRef.current = processor
        setStatus('AssemblyAI streaming active')
    }, [acceptFinalTranscript])

    const startListening = async () => {
        setError('')
        setIsStarting(true)
        transcriptRef.current = []
        setTranscript([])
        setSuggestions([])
        lastAiAtRef.current = 0
        try {
            if (mode === 'assemblyai') await startAssemblyAi()
            else startBrowserSpeech()
            setIsListening(true)
        } catch (caught) {
            stopListening()
            setError(caught instanceof Error ? caught.message : 'Could not start live coaching.')
        } finally {
            setIsStarting(false)
        }
    }

    const copyTranscript = async () => {
        if (!transcript.length) return
        await navigator.clipboard.writeText(transcript.join('\n'))
        setStatus('Transcript copied')
    }

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            <header className="view-header">
                <div>
                    <h2>Live Coach</h2>
                    <p>Transcription and context-aware guidance while you talk.</p>
                </div>
                <span className={`status-chip ${isListening ? 'is-live' : ''}`}>
                    <span /> {isListening ? 'Live' : status || 'Offline'}
                </span>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {error && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs leading-5 text-destructive" role="alert">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <div>
                            {error}
                            {error.toLowerCase().includes('connect the extension') && (
                                <button type="button" onClick={onOpenConnection} className="mt-1 block font-semibold underline">Open connection</button>
                            )}
                        </div>
                    </div>
                )}

                {!isListening && liveLocked && paired && (
                    <div className="provider-lock mb-3" role="alert">
                        <div>
                            <strong>Live Coach locked</strong>
                            <p>Connect an AI provider in Dashboard Settings to unlock real-time coaching. AssemblyAI is optional for upgraded transcription.</p>
                        </div>
                        <a href="http://localhost:5178/settings" target="_blank" rel="noreferrer">
                            Open Dashboard Settings <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                )}

                {!isListening && (
                    <section className="setup-panel">
                        <div className="setup-heading">
                            <Settings2 className="h-4 w-4 text-primary" />
                            <div>
                                <h3>Coaching setup</h3>
                                <p>Choose the context and providers used for this session.</p>
                            </div>
                        </div>

                        <label className="field-label">
                            Prospect research
                            <select value={researchId} onChange={(event) => setResearchId(event.target.value)} disabled={liveLocked || !paired}>
                                <option value="">Latest saved research</option>
                                {context?.researchRecords.map((record) => (
                                    <option key={record.id} value={record.id}>{record.title}</option>
                                ))}
                            </select>
                        </label>

                        <label className="field-label">
                            Buyer persona
                            <select value={personaId} onChange={(event) => setPersonaId(event.target.value)} disabled={liveLocked || !paired}>
                                <option value="">All saved personas</option>
                                {context?.personas.map((persona) => (
                                    <option key={persona.id} value={persona.id}>{persona.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="field-label">
                            Transcription
                            <select value={mode} onChange={(event) => setMode(event.target.value as TranscriptMode)} disabled={liveLocked || !paired}>
                                <option value="browser">Browser speech · no separate API key</option>
                                {transcriptionStatus?.connected && <option value="assemblyai">AssemblyAI streaming · metered</option>}
                            </select>
                        </label>

                        <label className="field-label">
                            AI coach
                            <select value={providerId} onChange={(event) => setProviderId(event.target.value)} disabled={!providers.length || !paired}>
                                <option value="">Choose a connected AI provider</option>
                                {providers.map((provider) => (
                                    <option key={provider.id} value={provider.id}>{provider.name} · {provider.cost}</option>
                                ))}
                            </select>
                        </label>

                        <label className="check-row">
                            <input
                                type="checkbox"
                                checked={aiCoaching}
                                onChange={(event) => setAiCoaching(event.target.checked)}
                                disabled={!providerId || liveLocked || !paired}
                            />
                            <span>
                                <strong>Generate AI guidance during the session</strong>
                                <small>At most one provider request every 10 seconds. Provider charges may apply.</small>
                            </span>
                        </label>

                        <div className="context-summary">
                            <span><BookOpen /> {contextCounts.knowledge} knowledge items</span>
                            <span><ShieldCheck /> {contextCounts.personas} personas</span>
                            <span><Database /> {contextCounts.research} research records</span>
                        </div>
                        <p className="privacy-note">
                            Browser speech may use Chrome’s speech service. AssemblyAI sends microphone audio to your connected AssemblyAI account.
                        </p>
                    </section>
                )}

                {isListening && (
                    <div className="live-grid">
                        <section className="transcript-panel">
                            <div className="panel-heading">
                                <span><Radio className="h-3.5 w-3.5 text-primary" /> Live transcript</span>
                                {transcript.length > 0 && (
                                    <button type="button" onClick={copyTranscript} aria-label="Copy transcript"><Copy className="h-3.5 w-3.5" /></button>
                                )}
                            </div>
                            <div className="transcript-body" aria-live="polite">
                                {!transcript.length && !interim && (
                                    <div className="listening-empty">
                                        <AudioLines className="h-5 w-5 text-primary" />
                                        Listening for the conversation…
                                    </div>
                                )}
                                {transcript.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
                                {interim && <p className="interim">{interim}</p>}
                            </div>
                        </section>

                        <section className="coach-panel">
                            <div className="panel-heading">
                                <span><Lightbulb className="h-3.5 w-3.5 text-primary" /> Coaching</span>
                                {selectedProvider && aiCoaching && <small>{selectedProvider.name}</small>}
                            </div>
                            <div className="coach-body" aria-live="polite">
                                {!suggestions.length && (
                                    <div className="coach-empty">
                                        <Sparkles className="h-5 w-5 text-primary" />
                                        Suggestions appear after a complete thought or matched objection.
                                    </div>
                                )}
                                {suggestions.map((suggestion) => (
                                    <article key={suggestion.id}>
                                        <span>{suggestion.label === 'AI coach' ? <Sparkles /> : <CheckCircle2 />}{suggestion.label}</span>
                                        <p>{suggestion.content}</p>
                                    </article>
                                ))}
                            </div>
                        </section>
                    </div>
                )}
            </div>

            <footer className="action-footer">
                <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    disabled={isStarting || liveLocked || !paired}
                    className={isListening ? 'stop-button' : 'primary-button w-full'}
                >
                    {isListening
                        ? <><MicOff className="h-4 w-4" /> End live coaching</>
                        : <><Mic className="h-4 w-4" /> {liveLocked ? 'Connect an AI provider to unlock' : isStarting ? 'Starting…' : 'Start live coaching'}</>}
                </button>
                {!isListening && <p>Starting is the explicit action that enables microphone access and any selected metered providers.</p>}
            </footer>
        </div>
    )
}
