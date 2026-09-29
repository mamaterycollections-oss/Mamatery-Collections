import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Daily safety net (Vercel Cron). pg_cron already does this every 10 minutes;
// this keeps things tidy if the database scheduler is ever unavailable.
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  const { data: expired, error } = await admin.rpc('expire_unpaid_orders', { p_minutes: 45 })
  await admin.from('rate_limits').delete().lt('window_start', new Date(Date.now() - 86400000).toISOString())
  return NextResponse.json({ expired: expired ?? 0, error: error?.message ?? null })
}
