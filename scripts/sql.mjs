// Run ad-hoc SQL against DATABASE_URL: node scripts/sql.mjs "select 1"
import { config } from 'dotenv'
import pg from 'pg'

config({ path: '.env.local', quiet: true })

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
try {
  const res = await client.query(process.argv[2])
  for (const r of [res].flat()) if (r.rows?.length) console.table(r.rows)
} finally {
  await client.end()
}
