// Generates src/lib/supabase/database.types.ts straight from the database
// catalog (no Docker needed). Run after every migration: npm run db:types
import { config } from 'dotenv'
import pg from 'pg'
import { writeFileSync } from 'node:fs'

config({ path: '.env.local', quiet: true })

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

const { rows: enums } = await client.query(`
  select t.typname as name, array_agg(e.enumlabel::text order by e.enumsortorder) as labels
  from pg_type t join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' group by t.typname order by t.typname`)

const { rows: cols } = await client.query(`
  select c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable = 'YES' as nullable,
         (c.column_default is not null or c.is_identity = 'YES') as has_default,
         t.table_type
  from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public'
  order by c.table_name, c.ordinal_position`)
const { rows: fks } = await client.query(`
  select con.conname as name, src.relname as table_name, ref.relname as ref_table,
         array(select a.attname::text from unnest(con.conkey) k join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k) as cols,
         array(select a.attname::text from unnest(con.confkey) k join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k) as ref_cols,
         exists (
           select 1 from pg_constraint u
           where u.conrelid = con.conrelid and u.contype in ('u', 'p') and u.conkey::int[] @> con.conkey::int[] and u.conkey::int[] <@ con.conkey::int[]
         ) as one_to_one
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_class ref on ref.oid = con.confrelid
  join pg_namespace n on n.oid = src.relnamespace
  join pg_namespace rn on rn.oid = ref.relnamespace
  where con.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public'
  order by con.conname`)
// Public RPC functions (named IN args only; no overload support needed here).
const { rows: fns } = await client.query(`
  select p.proname as name,
         coalesce(array(select unnest(p.proargnames)), '{}') as all_names,
         coalesce(array(select format_type(t, null) from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) t), '{}') as all_types,
         coalesce(array(select m::text from unnest(p.proargmodes) m), '{}') as modes,
         p.pronargs as nargs, p.pronargdefaults as ndefaults,
         format_type(p.prorettype, null) as ret,
         p.proretset as returns_set
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  order by p.proname`)
await client.end()

const relsFor = (table) =>
  fks
    .filter((f) => f.table_name === table)
    .map((f) => `{\n  foreignKeyName: '${f.name}'\n  columns: [${f.cols.map((c) => `'${c}'`).join(', ')}]\n  isOneToOne: ${f.one_to_one}\n  referencedRelation: '${f.ref_table}'\n  referencedColumns: [${f.ref_cols.map((c) => `'${c}'`).join(', ')}]\n}`)

const enumNames = new Set(enums.map((e) => e.name))
const scalar = (udt) => {
  if (enumNames.has(udt)) return `Database['public']['Enums']['${udt}']`
  if (['int2', 'int4', 'int8', 'float4', 'float8', 'numeric'].includes(udt)) return 'number'
  if (udt === 'bool') return 'boolean'
  if (['json', 'jsonb'].includes(udt)) return 'Json'
  return 'string'
}
const tsType = (c) => {
  const base = c.data_type === 'ARRAY' ? `${scalar(c.udt_name.replace(/^_/, ''))}[]` : scalar(c.udt_name)
  return c.nullable ? `${base} | null` : base
}

const byTable = new Map()
for (const c of cols) {
  if (!byTable.has(c.table_name)) byTable.set(c.table_name, { type: c.table_type, cols: [] })
  byTable.get(c.table_name).cols.push(c)
}

const indent = (s, n) => s.split('\n').map((l) => ' '.repeat(n) + l).join('\n')
const block = (cols, mode) =>
  cols.map((c) => {
    const optional = mode === 'update' || (mode === 'insert' && (c.nullable || c.has_default))
    return `${c.column_name}${optional ? '?' : ''}: ${tsType(c)}`
  }).join('\n')

let tables = ''
let views = ''
for (const [name, t] of byTable) {
  if (t.type === 'VIEW') {
    const viewCols = t.cols.map((c) => ({ ...c, nullable: true }))
    views += `${name}: {\n  Row: {\n${indent(block(viewCols, 'row'), 4)}\n  }\n  Relationships: []\n}\n`
  } else {
    const rels = relsFor(name)
    const relBlock = rels.length ? `[\n${indent(rels.join(',\n'), 4)}\n  ]` : '[]'
    tables += `${name}: {\n  Row: {\n${indent(block(t.cols, 'row'), 4)}\n  }\n  Insert: {\n${indent(block(t.cols, 'insert'), 4)}\n  }\n  Update: {\n${indent(block(t.cols, 'update'), 4)}\n  }\n  Relationships: ${relBlock}\n}\n`
  }
}
const pgScalar = (t) => {
  if (/^(smallint|integer|bigint|real|double precision|numeric)/.test(t)) return 'number'
  if (t === 'boolean') return 'boolean'
  if (t === 'json' || t === 'jsonb') return 'Json'
  if (t === 'void') return 'undefined'
  if (enumNames.has(t)) return `Database['public']['Enums']['${t}']`
  return 'string'
}
const functions = fns
  .filter((f) => f.ret !== 'trigger')
  .map((f) => {
    // IN args come first (no modes = all IN); the last `ndefaults` of them have defaults.
    const idx = f.all_types.map((_, i) => i)
    const inIdx = f.modes.length ? idx.filter((i) => ['i', 'b', 'v'].includes(f.modes[i])) : idx
    const outIdx = f.modes.length ? idx.filter((i) => f.modes[i] === 't') : []
    const args = inIdx
      .map((i, n) => `${f.all_names[i]}${n >= f.nargs - f.ndefaults ? '?' : ''}: ${pgScalar(f.all_types[i])}`)
      .join('\n')
    const ret = outIdx.length
      ? `{\n${indent(outIdx.map((i) => `${f.all_names[i]}: ${pgScalar(f.all_types[i])} | null`).join('\n'), 4)}\n  }[]`
      : pgScalar(f.ret) + (f.returns_set ? '[]' : '')
    return `${f.name}: {\n  Args: ${args ? `{\n${indent(args, 4)}\n  }` : 'Record<string, never>'}\n  Returns: ${ret}\n}`
  })
  .join('\n')

const enumBlock = enums.map((e) => `${e.name}: ${e.labels.map((l) => `'${l}'`).join(' | ')}`).join('\n')

const out = `// AUTO-GENERATED by scripts/gen-types.mjs — do not edit by hand.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
${indent(tables.trimEnd(), 6)}
    }
    Views: {
${indent(views.trimEnd(), 6)}
    }
    Functions: ${functions ? `{
${indent(functions, 6)}
    }` : 'Record<string, never>'}
    Enums: {
${indent(enumBlock, 6)}
    }
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
`
writeFileSync('src/lib/supabase/database.types.ts', out)
console.log(`wrote ${byTable.size} tables/views, ${enums.length} enums`)
