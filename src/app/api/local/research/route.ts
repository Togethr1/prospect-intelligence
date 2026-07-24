import { NextResponse } from 'next/server'
import { assertExtensionPaired } from '@/integrations/pairing'
import { db } from '@/lib/local-db'
import { assertLocalRequest, cleanText, publicError, readJsonObject, SafeRequestError } from '@/lib/security'

export async function GET(request: Request) {
    try {
        assertLocalRequest(request)
        if ((request.headers.get('origin') || '').startsWith('chrome-extension://')) assertExtensionPaired(request)
        return NextResponse.json({ records: db.getResearchHistory().slice(0, 6) })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}

export async function POST(request: Request) {
    try {
        const origin = request.headers.get('origin') || ''
        if (origin.startsWith('chrome-extension://')) assertExtensionPaired(request)
        const body = await readJsonObject(request)
        const url = cleanText(body.url, 2_048)
        const title = cleanText(body.title, 300)
        const source = body.source === 'extension' ? 'extension' as const : 'dashboard' as const
        if (!url || !title || !body.salesAssets) throw new SafeRequestError('URL, title, and research results are required.')
        return NextResponse.json(db.saveResearchRecord({
            url,
            title,
            sales_assets: body.salesAssets,
            crm_context: body.crmContext,
            source,
        }))
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await readJsonObject(request)
        if ((request.headers.get('origin') || '').startsWith('chrome-extension://')) assertExtensionPaired(request)
        const id = cleanText(body.id, 100)
        if (!id) throw new SafeRequestError('Research record ID is required.')
        db.deleteResearchRecord(id)
        return NextResponse.json({ deleted: true })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
