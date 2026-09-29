'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Enums } from '@/lib/supabase/database.types'

type AuthState = {
  userId: string | null
  role: Enums<'app_role'> | null
  name: string | null
  ready: boolean
}

const AuthContext = createContext<AuthState>({ userId: null, role: null, name: null, ready: false })
export const useAuth = () => useContext(AuthContext)

// Lightweight signed-in state for the storefront chrome (header, cart sync).
// Access control never relies on this — the server and database enforce it.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ userId: null, role: null, name: null, ready: false })

  useEffect(() => {
    const supabase = createClient()
    let active = true
    const load = async (userId: string | null) => {
      if (!userId) {
        if (active) setState({ userId: null, role: null, name: null, ready: true })
        return
      }
      const { data } = await supabase.from('profiles').select('role, full_name').eq('id', userId).maybeSingle()
      if (active) setState({ userId, role: data?.role ?? 'customer', name: data?.full_name ?? null, ready: true })
    }
    supabase.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') load(session?.user.id ?? null)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => state, [state])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
