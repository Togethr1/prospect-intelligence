'use server'

import { db } from '@/lib/local-db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// Define the shape of the data needed to create a persona
// This matches the form data structure
interface CreatePersonaData {
    name: string
    jobTitle: string
    industry: string
    personalityType: string
    keyObjections: string[]
    buyingCriteria: string[]
    tone?: string
}

export async function createPersona(data: CreatePersonaData) {
    let persona;
    try {
        persona = db.createPersona({
            name: data.name,
            personality_config: {
                jobTitle: data.jobTitle,
                industry: data.industry,
                personalityType: data.personalityType,
                keyObjections: data.keyObjections,
                buyingCriteria: data.buyingCriteria,
                tone: data.tone,
            },
        })
    } catch (error: any) {
        throw new Error('Failed to create persona: ' + error.message)
    }

    revalidatePath('/')
    redirect(`/practice/${persona.id}`)
}

export async function getPersonas() {
    return db.getPersonas()
}
