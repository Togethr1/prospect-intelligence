'use server'

import { db, type KnowledgeItem } from '@/lib/local-db'
import { revalidatePath } from 'next/cache'
import { LIMITS } from '@/lib/security'
import { localIdSchema } from '@/lib/persona-validation'
import { z } from 'zod'
import { PDFParse } from 'pdf-parse'

const knowledgeTypeSchema = z.string().trim().min(1).max(64).regex(/^[a-z0-9_-]+$/i)
const knowledgeTitleSchema = z.string().trim().min(1).max(300)
const knowledgeContentSchema = z.string().trim().min(1).max(1_000_000)

export async function createKnowledgeItem(rawType: string, rawTitle: string, rawContent: string) {
    const type = knowledgeTypeSchema.parse(rawType)
    const title = knowledgeTitleSchema.parse(rawTitle)
    const content = knowledgeContentSchema.parse(rawContent)
    const item = db.createKnowledgeItem({
        content,
        embedding: null,
        metadata: {
            type,
            title,
            createdAt: new Date().toISOString(),
        },
    })
    revalidatePath('/knowledge')
    return item
}

export async function deleteKnowledgeItem(rawId: string) {
    const id = localIdSchema.parse(rawId)
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
    const service = z.object({
        name: z.string().trim().min(1).max(200),
        valueProposition: z.string().trim().min(1).max(4_000),
        targetAudience: z.string().trim().min(1).max(2_000),
        painPoints: z.array(z.string().trim().min(1).max(500)).max(30),
    }).strict().parse(data)
    const content = [
        `Service: ${service.name}`,
        `Value proposition: ${service.valueProposition}`,
        `Target audience: ${service.targetAudience}`,
        `Pain points: ${service.painPoints.join('; ')}`,
    ].join('\n')
    return createKnowledgeItem('service_offering', service.name, content)
}

export async function uploadDocument(formData: FormData) {
    const candidate = formData.get('file')
    const file = candidate instanceof File ? candidate : null
    const type = knowledgeTypeSchema.parse(formData.get('type') || 'document')
    if (!file) throw new Error('No file provided.')
    knowledgeTitleSchema.parse(file.name)
    if (file.size > LIMITS.uploadBytes) throw new Error('Files are limited to 5 MB.')
    if (!['application/pdf', 'text/plain', 'text/markdown'].includes(file.type)) {
        throw new Error('Only PDF, plain text, and Markdown files are accepted.')
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let textContent = ''
    if (file.type === 'application/pdf') {
        if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
            throw new Error('The uploaded file is not a valid PDF.')
        }
        const parser = new PDFParse({ data: buffer })
        try {
            const result = await parser.getText({ first: 100 })
            if (result.total > 100) throw new Error('PDF documents are limited to 100 pages.')
            textContent = result.text
        } catch (error) {
            if (error instanceof Error && error.message === 'PDF documents are limited to 100 pages.') throw error
            throw new Error('Failed to parse PDF text.')
        } finally {
            await parser.destroy().catch(() => undefined)
        }
    } else {
        textContent = await file.text()
    }

    textContent = knowledgeContentSchema.parse(textContent)
    const extension = file.type === 'application/pdf' ? '.pdf' : file.type === 'text/markdown' ? '.md' : '.txt'
    const storedFile = db.saveKnowledgeUpload(extension, buffer)
    let item: KnowledgeItem
    try {
        item = db.createKnowledgeItem({
            content: textContent,
            embedding: null,
            metadata: {
                type,
                title: file.name,
                createdAt: new Date().toISOString(),
                storedFile,
            },
        })
    } catch (error) {
        db.deleteKnowledgeUpload(storedFile)
        throw error
    }
    revalidatePath('/knowledge')
    return item
}
