import { NextResponse } from 'next/server'
import { cleanText, publicError, readJsonObject, SafeRequestError } from '@/lib/security'
import { fetchPublicWebpage } from '@/lib/safe-web-fetch'

export async function POST(request: Request) {
    try {
        const body = await readJsonObject(request)
        const rawUrl = cleanText(body.url, 2_048)
        if (!rawUrl) throw new SafeRequestError('A website URL is required.')
        const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
        return NextResponse.json(await fetchPublicWebpage(url))
    } catch (error) {
        if (error instanceof Error && !(error instanceof SafeRequestError)) {
            return NextResponse.json({ error: error.message }, { status: 422 })
        }
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
