import { NextResponse } from 'next/server'
import {
    approveExtension,
    claimExtensionApproval,
    listExtensionPairingState,
    requestExtensionApproval,
    revokeExtension,
} from '@/integrations/pairing'
import {
    assertDashboardRequest,
    cleanText,
    publicError,
    readJsonObject,
    SafeRequestError,
} from '@/lib/security'

export async function GET(request: Request) {
    try {
        assertDashboardRequest(request)
        return NextResponse.json(listExtensionPairingState())
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}

export async function POST(request: Request) {
    try {
        const body = await readJsonObject(request)
        const action = cleanText(body.action, 30)
        if (action === 'request') {
            return NextResponse.json(requestExtensionApproval(request))
        }
        if (action === 'status') {
            return NextResponse.json(claimExtensionApproval(request, cleanText(body.requestId, 80)))
        }
        if (action === 'approve') {
            assertDashboardRequest(request)
            return NextResponse.json(approveExtension(cleanText(body.requestId, 80)))
        }
        if (action === 'revoke') {
            assertDashboardRequest(request)
            revokeExtension(cleanText(body.id, 80))
            return NextResponse.json(listExtensionPairingState())
        }
        throw new SafeRequestError('Unknown extension approval action.')
    } catch (error) {
        const safe = publicError(error)
        return NextResponse.json({ error: safe.message }, { status: safe.status })
    }
}
