import { z } from 'zod'

const shortListItem = z.string().trim().min(1).max(500)

export const personaInputSchema = z.object({
    name: z.string().trim().min(2).max(120),
    jobTitle: z.string().trim().min(2).max(200),
    industry: z.string().trim().min(2).max(200),
    scenario: z.string().trim().min(10).max(4_000),
    personalityType: z.enum(['Skeptical', 'Busy', 'Friendly', 'Analytical', 'Aggressive']),
    keyObjections: z.array(shortListItem).min(1).max(20),
    buyingCriteria: z.array(shortListItem).min(1).max(20),
    voiceGender: z.enum(['man', 'woman']),
    voiceTone: z.enum([
        'warm',
        'professional',
        'friendly',
        'confident',
        'calm',
        'energetic',
        'direct',
        'empathetic',
        'authoritative',
        'conversational',
    ]),
}).strict()

export const localIdSchema = z.string().uuid()

export type PersonaInput = z.infer<typeof personaInputSchema>
