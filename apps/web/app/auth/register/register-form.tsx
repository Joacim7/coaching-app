'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dumbbell, Building2 } from 'lucide-react'

interface InviteInfo {
  email: string
  orgName: string
  valid: boolean
}

export default function RegisterForm() {
  const router = useRouter()

  // Read directly from window.location (not useSearchParams) so this page
  // never needs a Suspense boundary — see login-form.tsx for the same choice.
  const inviteToken = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('invite')
    : null

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [inviteError, setInviteError] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!inviteToken) return
    fetch(`/api/organization/invitations/${inviteToken}`)
      .then(res => res.json())
      .then(data => {
        if (data.error || !data.valid) {
          setInviteError(data.error ?? 'Denne invitasjonen er ikke lenger gyldig')
          return
        }
        setInvite(data)
        setEmail(data.email)
      })
      .catch(() => setInviteError('Kunne ikke laste invitasjonen'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Created lazily here (not at module/render time) so this page never
    // needs NEXT_PUBLIC_SUPABASE_URL/ANON_KEY during prerendering/build —
    // this only ever runs client-side, on an actual submit.
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: 'coach', full_name: fullName },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (inviteToken && invite) {
      const res = await fetch('/api/organization/invitations/accept', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token: inviteToken }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[register] failed to join organization:', data.error)
      }
      router.push('/organization')
      router.refresh()
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2d8653] rounded-xl flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">CoachApp</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Opprett coach-konto</CardTitle>
            <CardDescription>
              {invite ? `Registrer deg for å bli coach hos ${invite.orgName}` : 'Registrer deg for å komme i gang'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invite && (
              <div className="flex items-start gap-2.5 mb-4 bg-[#ebf5ef] border border-[#cdeee3] rounded-lg px-3.5 py-3">
                <Building2 className="w-4 h-4 text-[#2d8653] mt-0.5 flex-shrink-0" />
                <p className="text-sm text-[#1a5c3a]">
                  Du er invitert som coach til <strong>{invite.orgName}</strong>. Fullfør registreringen
                  for å bli lagt til automatisk.
                </p>
              </div>
            )}
            {inviteError && (
              <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg mb-4">{inviteError}</p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="fullName">Fullt navn</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Ola Nordmann"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">E-post</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="din@epost.no"
                  readOnly={!!invite}
                  className={invite ? 'bg-gray-50 text-gray-500' : undefined}
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Passord</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg space-y-1">
                  <p>{error}</p>
                  {invite && (
                    <p>
                      Har du allerede en konto?{' '}
                      <Link
                        href={`/auth/login?next=/accept-invite/${inviteToken}`}
                        className="underline font-medium"
                      >
                        Logg inn for å godta invitasjonen
                      </Link>
                    </p>
                  )}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Oppretter konto...' : 'Opprett konto'}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-600">
              Har du konto?{' '}
              <Link
                href={inviteToken ? `/auth/login?next=/accept-invite/${inviteToken}` : '/auth/login'}
                className="text-[#2d8653] hover:underline font-medium"
              >
                Logg inn
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
