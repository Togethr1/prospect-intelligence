import { NextResponse } from 'next/server'
import { assertLocalRequest, cleanText, publicError, readJsonObject, SafeRequestError } from '@/lib/security'
import { createPairingCode, redeemPairingCode } from '@/integrations/pairing'

export async function POST(request: Request) {
    try {
        const body = await readJsonObject(request)
        const action = cleanText(body.action, 30)
        const origin = request.headers.get('origin') || ''
        if (action === 'create') {
            if (origin.startsWith('chrome-extension://')) throw new SafeRequestError('Only the dashboard can create pairing codes.', 403)
            assertLocalRequest(request)
            return NextResponse.json(createPairingCode())
        }
        if (action === 'redeem') {
            if (!origin.startsWith('chrome-extension://')) throw new SafeRequestError('Pairing must be redeemed by the extension.', 403)
            const extensionId = new URL(origin).hostname
            const token = redeemPairingCode(cleanText(body.code, 6), extensionId)
            return NextResponse.json({ token })
        }
        return NextResponse.json({ error: 'Unknown pairing action.' }, { status: 400 })
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
