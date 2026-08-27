'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // A password-recovery link that couldn't reach /auth/reset-password
    // directly (e.g. a not-yet-rebuilt mobile app whose redirectTo wasn't
    // trusted by Supabase) falls back to this bare origin, carrying its
    // session as #access_token=...&type=recovery. A server-side redirect()
    // to /dashboard can't preserve that — per standard URL resolution, a
    // Location header naming a new path replaces the previous URL's whole
    // path/query/fragment rather than inheriting its fragment, so the
    // tokens would be silently lost before /dashboard or /auth/login ever
    // saw them (that's why checking for them on /auth/login didn't work).
    // Read the hash here, client-side, before choosing where to go, and
    // build the next URL explicitly so it's preserved.
    // TEMPORARY: remove once the mobile app is rebuilt with the corrected
    // redirectTo, so recovery links land on /auth/reset-password directly.
    if (window.location.hash.includes('type=recovery')) {
      window.location.replace('/auth/reset-password' + window.location.hash)
      return
    }
    router.replace('/dashboard')
  }, [router])

  return null
}
