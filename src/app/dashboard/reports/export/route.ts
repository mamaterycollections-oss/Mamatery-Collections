import { NextResponse, type NextRequest } from 'next/server'
import { getSession, permissionsFor } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { rangeFromPreset, toCsv } from '@/lib/utils'

// CSV downloads for the accountant. The database functions enforce who may see what.
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session || !permissionsFor(session).manager) return NextResponse.json({ error: 'not allowed' }, { status: 403 })
  const sp = request.nextUrl.searchParams
  const supabase = await createClient()
  const type = sp.get('type')
  let rows: Record<string, unknown>[] = []
  let name = 'report'

  if (type === 'profit') {
    const range = rangeFromPreset(sp.get('range') ?? undefined)
    const { data, error } = await supabase.rpc('report_profit', {
      p_from: range.from.toISOString(),
      p_to: range.to.toISOString(),
      p_group: sp.get('group') ?? 'product',
      ...(sp.get('category') && { p_category: sp.get('category')! }),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 403 })
    rows = (data ?? []).map((r) => ({ item: r.label, category: r.category, units: r.units, sales_kes: r.sales, cost_kes: r.cost, profit_kes: r.profit, margin_pct: r.margin_pct }))
    name = `profit-${sp.get('group') ?? 'product'}-${range.preset}`
  } else if (type === 'stock') {
    const { data } = await supabase.rpc('report_stock_valuation')
    rows = (data ?? []).map((r) => ({ category: r.category, variants: r.variants, units: r.units, cost_value_kes: r.cost_value, retail_value_kes: r.retail_value }))
    name = 'stock-valuation'
  } else {
    return NextResponse.json({ error: 'unknown report' }, { status: 400 })
  }
  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="mamaterry-${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
