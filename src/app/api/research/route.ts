import { NextResponse } from 'next/server'
import { analyzeLocally } from '@/lib/local-analysis'
import { LIMITS, cleanText, publicError, readJsonObject } from '@/lib/security'
import { db } from '@/lib/local-db'
import { assertExtensionPaired } from '@/integrations/pairing'

export async function POST(request: Request) {
    try {
        const body = await readJsonObject(request)
        assertExtensionPaired(request)
        const pageText = cleanText(body.pageText, LIMITS.pageTextChars)
        if (pageText.length < 50) {
            return NextResponse.json(
                { error: 'Paste or capture at least 50 characters of page text. Server-side URL fetching is disabled for safety.' },
                { status: 400 },
            )
        }
        const url = cleanText(body.url, 2_048)
        const pageTitle = cleanText(body.pageTitle, 300)
        return NextResponse.json({
            salesAssets: analyzeLocally(pageText, pageTitle, url),
            websiteTitle: pageTitle || url,
            kbItems: db.getKnowledgeItems().slice(0, 20).map((item) => `[${item.metadata.type}] ${item.content.slice(0, 500)}`),
        })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
