import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/utils'

// Marks a notification read, then opens what it points to.
export async function GET(request: NextRequest, ctx: RouteContext<'/dashboard/notifications/[id]'>) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).select('link').maybeSingle()
  return NextResponse.redirect(new URL(safeNext(data?.link, '/dashboard/notifications'), request.url))
}
