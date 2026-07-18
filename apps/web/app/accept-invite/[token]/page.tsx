'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Building2, CheckCircle2, Loader2, XCircle } from 'lucide-react'

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const router    = useRouter()

  const [state, setState] = useState<'loading' | 'success' | 'error' | 'needsLogin'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function accept() {
      const res = await fetch('/api/organization/invitations/accept', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      })

      if (res.status === 401) {
        setState('needsLogin')
        return
      }

      const data = await res.json()

      if (res.ok) {
        setState('success')
        setTimeout(() => router.push('/organization'), 2000)
      } else {
        setState('error')
        setMessage(data.error ?? 'Noe gikk galt')
      }
    }
    accept()
  }, [token, router])

  return (
    <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-md w-full text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-[#ebf5ef] flex items-center justify-center mx-auto">
          <Building2 className="w-7 h-7 text-[#2d8653]" />
        </div>

        {state === 'loading' && (
          <>
            <Loader2 className="w-6 h-6 text-[#2d8653] animate-spin mx-auto" />
            <p className="text-sm text-gray-500">Godkjenner invitasjon…</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 className="w-8 h-8 text-[#2d8653] mx-auto" />
            <h2 className="text-lg font-bold text-gray-900">Velkommen!</h2>
            <p className="text-sm text-gray-500">Du er nå med i organisasjonen. Sender deg videre…</p>
          </>
        )}

        {state === 'needsLogin' && (
          <>
            <h2 className="text-lg font-bold text-gray-900">Logg inn for å akseptere</h2>
            <p className="text-sm text-gray-500">Du må være innlogget for å godkjenne invitasjonen.</p>
            <a
              href={`/auth/login?next=/accept-invite/${token}`}
              className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-[#2d8653] text-white text-sm font-semibold hover:bg-[#1a5c3a] transition-colors"
            >
              Logg inn
            </a>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle className="w-8 h-8 text-red-400 mx-auto" />
            <h2 className="text-lg font-bold text-gray-900">Ugyldig invitasjon</h2>
            <p className="text-sm text-gray-500">{message}</p>
            <a
              href="/organization"
              className="inline-flex items-center justify-center h-10 px-5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Gå til organisasjon
            </a>
          </>
        )}
      </div>
    </div>
  )
}
