import { NextResponse } from 'next/server'
import { publicError, readJsonObject } from '@/lib/security'

export async function POST(request: Request) {
    try {
        await readJsonObject(request)
        return NextResponse.json(
            { error: 'Google Places is disabled in the zero-cost build.' },
            { status: 410 },
        )
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
