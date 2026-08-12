'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import OnboardingForm from './onboarding-form'
import type { CheckinTemplate } from '@coaching/types'

interface Props {
  token: string
  clientId: string
  fullName: string | null
  email: string | null
  hasAccount: boolean
  template: CheckinTemplate | null
}

type Step = 'password' | 'form'

export default function OnboardingFlow({ token, clientId, fullName, email, hasAccount, template }: Props) {
  // Skip the password step entirely if the account already exists, or if
  // there's no email on file at all (can't create an email/password account
  // without one — this only happens for manually-added clients).
  const [step, setStep] = useState<Step>(hasAccount || !email ? 'form' : 'password')

  // Coaches no longer type a placeholder name at invite time (the client
  // sets their own real name in the password step), so full_name is null
  // for a brand new client on their very first visit here.
  const greeting = fullName ? `Hei, ${fullName}!` : 'Hei!'

  console.log('[onboarding-flow] mounted — token:', token, 'clientId:', clientId, 'email:', email, 'hasAccount:', hasAccount, 'hasTemplate:', !!template, 'initialStep:', hasAccount || !email ? 'form' : 'password')

  if (step === 'password' && email) {
    return (
      <>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
          <p className="text-gray-500 mt-1">Sett et passord for å komme i gang</p>
        </div>
        <PasswordSetupStep
          token={token}
          email={email}
          onDone={() => setStep('form')}
        />
      </>
    )
  }

  if (!template) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Ingen skjema tilgjengelig</h1>
        <p className="text-gray-500 text-sm">Treneren din har ikke opprettet et oppstartsskjema ennå.</p>
      </div>
    )
  }

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
        <p className="text-gray-500 mt-1">Fyll ut skjemaet nedenfor for å komme i gang</p>
      </div>
      <OnboardingForm token={token} clientId={clientId} template={template} />
    </>
  )
}

function PasswordSetupStep({
  token,
  email,
  onDone,
}: {
  token: string
  email: string
  onDone: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

  // Uncontrolled inputs, read via ref on submit — mobile Safari's "Suggest
  // Strong Password" AutoFill sets these fields' DOM value without reliably
  // dispatching the input event React's onChange relies on, so a controlled
  // value prop can end up out of sync with (or fight) what's actually on
  // screen. Reading straight from the DOM at submit time sidesteps that.
  const firstNameRef = useRef<HTMLInputElement>(null)
  const lastNameRef  = useRef<HTMLInputElement>(null)
  const passwordRef  = useRef<HTMLInputElement>(null)
  const confirmRef   = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const firstName = firstNameRef.current?.value.trim() ?? ''
    const lastName  = lastNameRef.current?.value.trim() ?? ''
    const password  = passwordRef.current?.value ?? ''
    const confirm   = confirmRef.current?.value ?? ''

    if (!firstName || !lastName || !password || !confirm) return

    if (password.length < 8) {
      setError('Passordet må være minst 8 tegn')
      return
    }
    if (password !== confirm) {
      setError('Passordene er ikke like')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch(`/api/onboarding/${token}/set-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password, firstName, lastName }),
      })

      const rawText = await res.text()

      if (!res.ok) {
        let data: { error?: string } = {}
        try { data = JSON.parse(rawText) } catch { /* not JSON */ }
        setError(data.error ?? 'Noe gikk galt. Prøv igjen.')
        return
      }

      onDone()
    } catch (err) {
      setError('Kunne ikke koble til serveren. Sjekk internettforbindelsen og prøv igjen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Fornavn
          </label>
          <input
            ref={firstNameRef}
            type="text"
            placeholder="Ola"
            autoFocus
            autoComplete="given-name"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Etternavn
          </label>
          <input
            ref={lastNameRef}
            type="text"
            placeholder="Nordmann"
            autoComplete="family-name"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653] focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
          E-post
        </label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
          Passord
        </label>
        <input
          ref={passwordRef}
          type="password"
          placeholder="Minst 8 tegn"
          autoComplete="new-password"
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653] focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
          Bekreft passord
        </label>
        <input
          ref={confirmRef}
          type="password"
          placeholder="Gjenta passordet"
          autoComplete="new-password"
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653] focus:border-transparent"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      <Button
        type="submit"
        disabled={submitting}
        className="w-full h-auto py-4 rounded-2xl text-base font-semibold shadow-md"
      >
        {submitting ? 'Oppretter konto...' : 'Fortsett'}
      </Button>
    </form>
  )
}
