'use server'

import { db } from '@/lib/local-db'
import { revalidatePath } from 'next/cache'
import { LIMITS } from '@/lib/security'

// --- Generic Knowledge Item Actions ---

export async function createKnowledgeItem(type: string, title: string, content: string) {
    try {
        if (!content.trim() || content.length > 100_000) throw new Error('Content must be between 1 and 100,000 characters.')

        // 2. Save
        db.createKnowledgeItem({
            content,
            embedding: null,
            metadata: {
                type,
                title,
                createdAt: new Date().toISOString()
            }
        })

        revalidatePath('/knowledge')
    } catch (err: any) {
        console.error("Critical Error in createKnowledgeItem:", err)
        throw new Error(err.message || "Internal Server Error")
    }
}

export async function deleteKnowledgeItem(id: string) {
    db.deleteKnowledgeItem(id)
    revalidatePath('/knowledge')
}

export async function getKnowledgeItems(type?: string) {
    return db.getKnowledgeItems(type)
}

export async function createServiceOffering(data: {
    name: string
    valueProposition: string
    targetAudience: string
    painPoints: string[]
}) {
    const content = [
        `Service: ${data.name}`,
        `Value proposition: ${data.valueProposition}`,
        `Target audience: ${data.targetAudience}`,
        `Pain points: ${data.painPoints.join('; ')}`,
    ].join('\n')
    await createKnowledgeItem('service_offering', data.name, content)
}

export async function uploadDocument(formData: FormData) {
    const file = formData.get('file') as File
    const type = formData.get('type') as string || 'document'
    if (!file) throw new Error('No file provided')
    if (file.size > LIMITS.uploadBytes) throw new Error('Files are limited to 5 MB.')
    if (!['application/pdf', 'text/plain', 'text/markdown'].includes(file.type)) {
        throw new Error('Only PDF, plain text, and Markdown files are accepted.')
    }

    // 2. Parse Text (if PDF)
    let textContent = ""
    if (file.type === 'application/pdf') {
        try {
            const pdf = require('pdf-parse')
            const arrayBuffer = await file.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const data = await pdf(buffer)
            textContent = data.text
        } catch (e) {
            console.error("PDF Parse error", e)
            throw new Error("Failed to parse PDF text.")
        }
    } else {
        // Assume text/plain or similar
        textContent = await file.text()
    }

    // Truncate if too huge to avoid token limits on embedding (naive approach)
    // 8k chars is roughly 2k tokens
    const truncatedContent = textContent.slice(0, 20000)

    // 3. Generate Embedding & Save Knowledge Item
    await createKnowledgeItem(type, file.name, truncatedContent)

    revalidatePath('/knowledge')
}
