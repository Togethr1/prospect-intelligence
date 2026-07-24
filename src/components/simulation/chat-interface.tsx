'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
    LiveKitRoom,
    RoomAudioRenderer,
    StartAudio,
    useLocalParticipant,
    useRoomContext,
    useTranscriptions,
    useVoiceAssistant,
} from '@livekit/components-react'
import { Grid } from 'ldrs/react'
import 'ldrs/react/Grid.css'
import { AlertTriangle, Mic, MicOff, Phone, PhoneOff, ShieldCheck, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgentAudioVisualizerWave } from '@/components/agents-ui/agent-audio-visualizer-wave'
import type { Persona } from '@/types'

interface SessionCredentials {
    token: string
    serverUrl: string
    roomName: string
    personaName: string
    costNotice: string
}

export function ChatInterface({ persona }: { persona: Persona }) {
    const [session, setSession] = useState<SessionCredentials | null>(null)
    const [starting, setStarting] = useState(false)
    const [error, setError] = useState('')

    const startCall = async () => {
        setStarting(true)
        setError('')
        try {
            const response = await fetch('/api/livekit/session', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ personaId: persona.id }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'The LiveKit call could not start.')
            setSession(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'The LiveKit call could not start.')
        } finally {
            setStarting(false)
        }
    }

    if (!session) {
        return (
            <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-6 py-5">
                    <h2 className="text-lg font-semibold">Call {persona.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{persona.personality_config.jobTitle} · {persona.personality_config.industry}</p>
                </div>
                <div className="px-6 py-10 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                        <Phone className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold">Ready to practice?</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                        LiveKit will use your saved prospect, objections, buying criteria, and local knowledge to run this call.
                    </p>
                    <div className="mx-auto mt-5 flex max-w-md items-center justify-center gap-5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5"><Volume2 className="h-4 w-4" /> {persona.personality_config.voiceGender === 'man' ? 'Man' : 'Woman'}</span>
                        <span className="capitalize">{persona.personality_config.voiceTone || 'Professional'} tone</span>
                        <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Transcript saves locally</span>
                    </div>
                    {error && (
                        <div className="mx-auto mt-5 flex max-w-lg items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-left text-sm text-destructive">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                        </div>
                    )}
                    <Button className="mt-7 min-w-40" onClick={startCall} disabled={starting}>
                        {starting ? <><Grid size="22" speed="1.5" color="currentColor" /> Connecting…</> : <><Phone className="h-4 w-4" /> Start call</>}
                    </Button>
                    <p className="mt-4 text-[11px] text-muted-foreground">This action consumes usage from your connected LiveKit project.</p>
                </div>
            </div>
        )
    }

    return (
        <LiveKitRoom
            token={session.token}
            serverUrl={session.serverUrl}
            connect
            audio
            video={false}
            onError={(liveKitError) => setError(liveKitError.message)}
            onDisconnected={() => {
                fetch('/api/livekit/session', {
                    method: 'DELETE',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ roomName: session.roomName }),
                    keepalive: true,
                }).catch(() => undefined)
                setSession(null)
            }}
            className="mx-auto max-w-4xl"
        >
            <ActiveCall persona={persona} costNotice={session.costNotice} error={error} />
            <RoomAudioRenderer />
            <StartAudio label="Enable call audio" />
        </LiveKitRoom>
    )
}

function ActiveCall({ persona, costNotice, error }: { persona: Persona; costNotice: string; error: string }) {
    const room = useRoomContext()
    const { state, audioTrack } = useVoiceAssistant()
    const { localParticipant, isMicrophoneEnabled } = useLocalParticipant()
    const transcriptions = useTranscriptions()
    const sessionIdRef = useRef<string | undefined>(undefined)
    const [saveError, setSaveError] = useState('')
    const [ending, setEnding] = useState(false)

    const transcript = useMemo(() => transcriptions.map((item, index) => ({
        id: item.streamInfo.id || `${index}`,
        role: item.participantInfo.identity === localParticipant.identity ? 'user' as const : 'assistant' as const,
        content: item.text,
        timestamp: new Date().toISOString(),
    })).filter((item) => item.content.trim()), [localParticipant.identity, transcriptions])

    useEffect(() => {
        if (!transcript.length) return
        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch('/api/local/roleplay', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: sessionIdRef.current,
                        personaId: persona.id,
                        personaName: persona.name,
                        messages: transcript,
                    }),
                })
                const data = await response.json()
                if (!response.ok) throw new Error(data.error || 'Transcript could not be saved.')
                sessionIdRef.current = data.id
                setSaveError('')
            } catch (saveFailure) {
                setSaveError(saveFailure instanceof Error ? saveFailure.message : 'Transcript could not be saved.')
            }
        }, 750)
        return () => window.clearTimeout(timer)
    }, [persona.id, persona.name, transcript])

    const endCall = async () => {
        setEnding(true)
        await room.disconnect()
    }

    const stateLabel = state === 'speaking'
        ? `${persona.name} is speaking`
        : state === 'thinking'
            ? `${persona.name} is thinking`
            : state === 'listening'
                ? 'Listening to you'
                : 'Connecting'

    return (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="font-semibold">Live call with {persona.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{persona.personality_config.jobTitle} · {persona.personality_config.industry}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live
                </div>
            </div>

            <div className="grid min-h-[520px] lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="flex flex-col border-b border-border lg:border-b-0 lg:border-r">
                    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
                        <div className="flex h-56 w-full max-w-xl items-center justify-center">
                            {state === 'thinking' ? (
                                <Grid size="60" speed="1.5" color="var(--primary)" />
                            ) : (
                                <AgentAudioVisualizerWave
                                    size="lg"
                                    state={state}
                                    audioTrack={audioTrack}
                                    color="#ff6b00"
                                    colorShift={0}
                                    lineWidth={2}
                                    blur={0.35}
                                    className="w-full max-w-md"
                                    aria-label={`${persona.name} audio activity`}
                                />
                            )}
                        </div>
                        <p className="mt-5 text-lg font-medium">{stateLabel}</p>
                        <p className="mt-2 text-xs capitalize text-muted-foreground">{persona.personality_config.voiceTone || 'professional'} voice</p>
                    </div>

                    <div className="border-t border-border p-4">
                        {(error || saveError) && <p className="mb-3 text-center text-xs text-destructive">{error || saveError}</p>}
                        <div className="flex items-center justify-center gap-3">
                            <Button
                                variant={isMicrophoneEnabled ? 'secondary' : 'destructive'}
                                size="icon"
                                className="h-12 w-12 rounded-full"
                                onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
                                aria-label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
                            >
                                {isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                            </Button>
                            <Button variant="destructive" className="h-12 rounded-full px-6" onClick={endCall} disabled={ending}>
                                <PhoneOff className="h-5 w-5" /> End call
                            </Button>
                        </div>
                    </div>
                </div>

                <aside className="max-h-[520px] overflow-y-auto p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Transcript</p>
                    <div className="mt-4 space-y-4">
                        {transcript.length === 0 ? (
                            <p className="text-xs leading-5 text-muted-foreground">The live transcript will appear here and save to this device.</p>
                        ) : transcript.map((message) => (
                            <div key={message.id}>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{message.role === 'user' ? 'You' : persona.name}</p>
                                <p className="mt-1 text-xs leading-5">{message.content}</p>
                            </div>
                        ))}
                    </div>
                </aside>
            </div>
            <p className="border-t border-border px-4 py-2.5 text-center text-[10px] text-muted-foreground">{costNotice}</p>
        </div>
    )
}
