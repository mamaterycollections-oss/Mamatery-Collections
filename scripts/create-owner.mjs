// Creates (or promotes) the real owner login.
//   npm run create-owner -- owner@example.com "Terry Wanjiru"                  (prints a one-time password)
//   npm run create-owner -- owner@example.com "Terry Wanjiru" --password "…"  (sets that password)
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

config({ path: '.env.local', quiet: true })
const args = process.argv.slice(2)
const pwAt = args.indexOf('--password')
const chosen = pwAt >= 0 ? args.splice(pwAt, 2)[1] : null
const [email, ...nameParts] = args
const name = nameParts.join(' ') || 'Owner'
if (!email || !email.includes('@') || (pwAt >= 0 && !chosen)) {
  console.error('Usage: npm run create-owner -- email@example.com "Full Name" [--password "at least 8 characters"]')
  process.exit(1)
}
if (chosen && chosen.length < 8) {
  console.error('The password must be at least 8 characters.')
  process.exit(1)
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
let user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
let password = null
if (!user) {
  password = chosen ?? `Mt-${randomBytes(8).toString('base64url')}7`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } })
  if (error) throw error
  user = data.user
} else if (chosen) {
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: chosen, email_confirm: true, ban_duration: 'none' })
  if (error) throw error
  password = chosen
}
const { error } = await admin.from('profiles').update({ role: 'owner', full_name: name }).eq('id', user.id)
if (error) throw error
console.log(`\n✓ ${email} is now the OWNER.`)
if (chosen) console.log('  Password set as given. Sign in at /login.\n')
else console.log(password ? `  Temporary password: ${password}\n  Sign in at /login, then change it in Account → Settings.\n` : '  Existing account — sign in with its current password.\n')
