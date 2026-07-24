'use server'

import { db } from '@/lib/local-db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
    localIdSchema,
    personaInputSchema,
    type PersonaInput,
} from '@/lib/persona-validation'

function toRecord(data: PersonaInput) {
    return {
        name: data.name,
        personality_config: {
            jobTitle: data.jobTitle,
            industry: data.industry,
            scenario: data.scenario,
            personalityType: data.personalityType,
            keyObjections: data.keyObjections,
            buyingCriteria: data.buyingCriteria,
            voiceGender: data.voiceGender,
            voiceTone: data.voiceTone,
        },
    }
}

export async function createPersona(input: PersonaInput) {
    const data = personaInputSchema.parse(input)
    db.createPersona(toRecord(data))
    redirect('/roleplay')
}

export async function updatePersona(rawId: string, input: PersonaInput) {
    const id = localIdSchema.parse(rawId)
    const data = personaInputSchema.parse(input)
    db.updatePersona(id, toRecord(data))
    revalidatePath('/roleplay')
    revalidatePath(`/practice/${id}`)
    redirect('/roleplay')
}

export async function deletePersona(rawId: string) {
    const id = localIdSchema.parse(rawId)
    db.deletePersona(id)
    revalidatePath('/roleplay')
}

export async function getPersonas() {
    return db.getPersonas()
}
