// Applies pending supabase/migrations to the remote database, then regenerates types.
// npm run db:push
import { config } from 'dotenv'
import { execFileSync } from 'node:child_process'

config({ path: '.env.local', quiet: true })

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })

run('npx', ['supabase', 'db', 'push', '--db-url', `"${process.env.DATABASE_URL}"`, '--yes'])
run('node', ['scripts/gen-types.mjs'])
