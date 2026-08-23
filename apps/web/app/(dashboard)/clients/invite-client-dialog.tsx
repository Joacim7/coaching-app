'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus, X, CheckCircle2, Sparkles } from 'lucide-react'

export default function InviteClientDialog({
  coachId,
  triggerVariant = 'default',
}: {
  coachId: string
  triggerVariant?: 'default' | 'success'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [limitReached, setLimitReached] = useState(false)

  function reset() {
    setEmail('')
    setError('')
    setSuccess(false)
    setEmailSent(false)
    setLimitReached(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/invite-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), coachId }),
    })

    const result = await res.json()
    setLoading(false)

    if (!res.ok) {
      if (result.limitReached) {
        setLimitReached(true)
      } else {
        setError(result.error ?? 'Noe gikk galt')
      }
      return
    }

    setEmailSent(!!result.emailSent)
    setSuccess(true)
    setTimeout(() => {
      setOpen(false)
      reset()
      router.refresh()
    }, 1800)
  }

  return (
    <>
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        <UserPlus className="w-4 h-4" />
        Inviter klient
      </Button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Legg til klient</h2>
                <p className="text-xs text-gray-400 mt-0.5">Send en invitasjon til klientens e-post</p>
              </div>
              <button
                onClick={() => { setOpen(false); reset() }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {success ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7 text-green-600" />
                </div>
                <p className="font-semibold text-gray-900">Klient lagt til!</p>
                <p className="text-gray-500 text-sm mt-1">
                  Klienten er nå synlig i klientlisten
                </p>
                {emailSent && (
                  <p className="text-[#2d8653] text-xs mt-2 bg-[#ebf5ef] px-3 py-1.5 rounded-lg">
                    Oppstartsskjema sendt til {email}
                  </p>
                )}
              </div>
            ) : limitReached ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 bg-[#ebf5ef] rounded-full flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-7 h-7 text-[#2d8653]" />
                </div>
                <p className="font-semibold text-gray-900">Du har nådd klientgrensen din</p>
                <p className="text-gray-500 text-sm mt-1">
                  Oppgrader planen din for å legge til flere klienter
                </p>
                <div className="flex gap-3 pt-5">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setOpen(false); reset() }}
                  >
                    Lukk
                  </Button>
                  <Link href="/pricing" className="flex-1">
                    <Button type="button" className="w-full">
                      Se priser
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">E-post</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ola@eksempel.no"
                    required
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Brukes til å sende oppstartsskjema — klienten setter sitt eget navn der
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setOpen(false); reset() }}
                  >
                    Avbryt
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading || !email.trim()}>
                    {loading ? 'Legger til...' : 'Legg til klient'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
