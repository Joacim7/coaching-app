'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import OnboardingForm from './onboarding-form'
import type { CheckinTemplate } from '@coaching/types'

interface Props {
  token: string
  clientId: string
  fullName: string
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

  console.log('[onboarding-flow] mounted — token:', token, 'clientId:', clientId, 'email:', email, 'hasAccount:', hasAccount, 'hasTemplate:', !!template, 'initialStep:', hasAccount || !email ? 'form' : 'password')

  if (step === 'password' && email) {
    return (
      <>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Hei, {fullName}!</h1>
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
        <h1 className="text-2xl font-bold text-gray-900">Hei, {fullName}!</h1>
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
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef  = useRef<HTMLInputElement>(null)

  const tooShort   = password.length > 0 && password.length < 8
  const mismatch   = confirm.length > 0 && password !== confirm
  const canSubmit  = password.length >= 8 && password === confirm && !submitting

  // Logs on every keystroke *and* on autofill, independent of submit —
  // the handleSubmit log below only fires once canSubmit is already true,
  // which is useless for diagnosing why it's stuck false.
  useEffect(() => {
    console.log('[password-step] validation state — password.length:', password.length,
      'confirm.length:', confirm.length, 'match:', password === confirm, 'canSubmit:', canSubmit)
  }, [password, confirm, canSubmit])

  useEffect(() => {
    const passwordEl = passwordRef.current
    const confirmEl  = confirmRef.current
    if (!passwordEl || !confirmEl) return

    // Mobile Safari's "Suggest Strong Password" AutoFill can set these two
    // fields' DOM value without reliably dispatching the native 'input'
    // event React's onChange relies on — most often on the second (confirm)
    // field. When that happens the boxes look filled and matching on screen
    // but React's state (and therefore canSubmit) never updates, so the
    // button stays silently disabled. Binding directly to the DOM elements
    // here catches that case regardless of whether the browser fired a
    // proper input event for the synthetic onChange path.
    const handlePasswordInput = () => setPassword(passwordEl.value)
    const handleConfirmInput  = () => setConfirm(confirmEl.value)

    passwordEl.addEventListener('input', handlePasswordInput)
    confirmEl.addEventListener('input', handleConfirmInput)

    return () => {
      passwordEl.removeEventListener('input', handlePasswordInput)
      confirmEl.removeEventListener('input', handleConfirmInput)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    console.log('[password-step] handleSubmit fired — canSubmit:', canSubmit,
      'password.length:', password.length, 'match:', password === confirm, 'submitting:', submitting)

    if (!canSubmit) {
      console.warn('[password-step] blocked by canSubmit guard — not sending request')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      console.log('[password-step] POST /api/onboarding/' + token + '/set-password')
      const res = await fetch(`/api/onboarding/${token}/set-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      })

      const rawText = await res.text()
      console.log('[password-step] response status:', res.status, res.statusText, '— body:', rawText)

      if (!res.ok) {
        let data: { error?: string } = {}
        try { data = JSON.parse(rawText) } catch { /* not JSON */ }
        setError(data.error ?? 'Noe gikk galt. Prøv igjen.')
        return
      }

      console.log('[password-step] success — moving to form step')
      onDone()
    } catch (err) {
      console.error('[password-step] request threw an exception:', err)
      setError('Kunne ikke koble til serveren. Sjekk internettforbindelsen og prøv igjen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
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
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Minst 8 tegn"
          autoFocus
          autoComplete="new-password"
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653] focus:border-transparent"
        />
        {tooShort && (
          <p className="text-xs text-red-600 mt-1.5">Passordet må være minst 8 tegn</p>
        )}
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
          Bekreft passord
        </label>
        <input
          ref={confirmRef}
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Gjenta passordet"
          autoComplete="new-password"
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653] focus:border-transparent"
        />
        {mismatch && (
          <p className="text-xs text-red-600 mt-1.5">Passordene er ikke like</p>
        )}
      </div>

      {/* Always-visible requirement checklist — makes it obvious why the button is (or isn't) enabled */}
      <div className="space-y-1 -mt-1">
        <p className={`text-xs flex items-center gap-1.5 ${password.length >= 8 ? 'text-[#2d8653]' : 'text-gray-400'}`}>
          <span>{password.length >= 8 ? '✓' : '○'}</span> Minst 8 tegn
        </p>
        <p className={`text-xs flex items-center gap-1.5 ${confirm.length > 0 && password === confirm ? 'text-[#2d8653]' : 'text-gray-400'}`}>
          <span>{confirm.length > 0 && password === confirm ? '✓' : '○'}</span> Passordene er like
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      <Button
        type="submit"
        disabled={!canSubmit}
        className="w-full h-auto py-4 rounded-2xl text-base font-semibold shadow-md"
      >
        {submitting ? 'Oppretter konto...' : 'Fortsett'}
      </Button>
    </form>
  )
}
