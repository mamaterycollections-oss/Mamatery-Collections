import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { settleMpesa } from '@/lib/payments'
import type { Json } from '@/lib/supabase/database.types'

type Item = { Name: string; Value?: string | number }
type Callback = {
  Body?: { stkCallback?: { CheckoutRequestID?: string; ResultCode?: number | string; ResultDesc?: string; CallbackMetadata?: { Item?: Item[] } } }
}

const secretOk = (given: string | null) => {
  const expected = process.env.MPESA_CALLBACK_SECRET
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Safaricom posts the STK Push result here. The secret in the URL proves it came
// from the request we made; the amount is re-checked against the order.
export async function POST(request: NextRequest) {
  if (!secretOk(request.nextUrl.searchParams.get('secret'))) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: 'Rejected' }, { status: 401 })
  }
  const body = (await request.json().catch(() => null)) as Callback | null
  const cb = body?.Body?.stkCallback
  if (!cb?.CheckoutRequestID) return NextResponse.json({ ResultCode: 0, ResultDesc: 'Ignored' })

  const items = cb.CallbackMetadata?.Item ?? []
  const get = (name: string) => items.find((i) => i.Name === name)?.Value
  try {
    await settleMpesa({
      checkoutRequestId: cb.CheckoutRequestID,
      resultCode: Number(cb.ResultCode),
      resultDesc: cb.ResultDesc,
      receipt: get('MpesaReceiptNumber') != null ? String(get('MpesaReceiptNumber')) : null,
      amount: get('Amount') != null ? Number(get('Amount')) : null,
      raw: body as unknown as Json,
    })
  } catch (e) {
    console.error('mpesa callback', e)
  }
  // Always acknowledge so Safaricom doesn't keep retrying.
  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
}
