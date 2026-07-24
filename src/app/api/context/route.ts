import { NextResponse } from 'next/server'
import { db } from '@/lib/local-db'
import { assertLocalRequest, publicError } from '@/lib/security'

export async function GET(request: Request) {
    try {
        assertLocalRequest(request)
        const knowledgeItems = db.getKnowledgeItems()
        const personas = db.getPersonas()

        return NextResponse.json({
            knowledgeItems,
            personas
        })

    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
