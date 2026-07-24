import {
    ServerOptions,
    cli,
    defineAgent,
    inference,
    type JobContext,
    voice,
} from '@livekit/agents'
import { fileURLToPath } from 'node:url'
import { ROLEPLAY_AGENT_NAME, resolveVoice } from '../src/integrations/livekit/config'

interface RoleplayJob {
    prompt: string
    voiceGender: 'man' | 'woman'
    voiceTone: string
}

function parseJobMetadata(raw: string): RoleplayJob {
    const parsed = JSON.parse(raw) as Partial<RoleplayJob>
    if (!parsed.prompt || parsed.prompt.length > 40_000) throw new Error('Roleplay prompt is missing or too large.')
    return {
        prompt: parsed.prompt,
        voiceGender: parsed.voiceGender === 'man' ? 'man' : 'woman',
        voiceTone: typeof parsed.voiceTone === 'string' ? parsed.voiceTone.slice(0, 40) : 'professional',
    }
}

export default defineAgent({
    entry: async (ctx: JobContext) => {
        const job = parseJobMetadata(ctx.job.metadata)
        const selectedVoice = resolveVoice(job.voiceGender, job.voiceTone)
        const session = new voice.AgentSession({
            stt: new inference.STT({ model: 'deepgram/nova-3', language: 'en' }),
            llm: new inference.LLM({ model: 'google/gemma-4-31b-it' }),
            tts: new inference.TTS({
                model: selectedVoice.model,
                voice: selectedVoice.voice,
                language: 'en',
            }),
            turnHandling: {
                turnDetection: new inference.TurnDetector(),
            },
        })

        await session.start({
            agent: voice.Agent.create({ instructions: job.prompt }),
            room: ctx.room,
            record: false,
        })
        await ctx.connect()
        await session.generateReply({
            instructions: 'Answer the phone naturally in character. Keep the greeting short.',
        })
    },
})

cli.runApp(new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: ROLEPLAY_AGENT_NAME,
    logLevel: 'info',
}))
