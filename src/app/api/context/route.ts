import { NextResponse } from 'next/server'
import { assertExtensionPaired } from '@/integrations/pairing'
import { db } from '@/lib/local-db'
import { assertLocalRequest, publicError } from '@/lib/security'

export async function GET(request: Request) {
    try {
        assertLocalRequest(request)
        if ((request.headers.get('origin') || '').startsWith('chrome-extension://')) {
            assertExtensionPaired(request)
        }
        const knowledgeItems = db.getKnowledgeItems().slice(0, 30).map((item) => ({
            id: item.id,
            content: item.content.slice(0, 4_000),
            metadata: {
                type: item.metadata.type,
                title: item.metadata.title,
            },
        }))
        const personas = db.getPersonas().slice(0, 50)
        const researchRecords = db.getResearchHistory().slice(0, 5)

        return NextResponse.json({
            knowledgeItems,
            personas,
            researchRecords,
        })

    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
