import { NextResponse, type NextRequest } from 'next/server'
import { settleCard, verifyPaystackSignature } from '@/lib/payments'

// Paystack server-to-server notification. Signature-checked, then re-verified with Paystack.
export async function POST(request: NextRequest) {
  const raw = await request.text()
  if (!verifyPaystackSignature(raw, request.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 })
  }
  const event = JSON.parse(raw) as { event?: string; data?: { reference?: string } }
  if (event.event === 'charge.success' && event.data?.reference) {
    await settleCard(event.data.reference).catch((e) => console.error('paystack webhook', e))
  }
  return NextResponse.json({ ok: true })
}
