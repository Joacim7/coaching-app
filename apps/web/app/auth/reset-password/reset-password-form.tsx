'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dumbbell } from 'lucide-react'

export default function ResetPasswordForm() {
  const router = useRouter()

  // Supabase redirects back here with ?error=... instead of a session when
  // the recovery link is invalid or expired — no point showing the form then.
  const linkError = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('error_description')
    : null

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passordene er ikke like')
      return
    }

    setLoading(true)

    // Created lazily here (not at module/render time) so this page never
    // needs NEXT_PUBLIC_SUPABASE_URL/ANON_KEY during prerendering/build.
    // The recovery session behind this call was established client-side by
    // the browser client itself, from the ?code= param Supabase put in the
    // reset-password link.
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Sign the recovery session out so the user lands on a clean login
    // screen and confirms the new password, rather than being silently
    // logged in.
    await supabase.auth.signOut()
    router.push('/auth/login?reset=success')
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
            <CardTitle>Nytt passord</CardTitle>
            <CardDescription>Velg et nytt passord for kontoen din</CardDescription>
          </CardHeader>
          <CardContent>
            {linkError ? (
              <div className="space-y-4">
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  Lenken er ugyldig eller har utløpt. Be om en ny lenke for å tilbakestille
                  passordet.
                </p>
                <Link href="/auth/forgot-password">
                  <Button type="button" className="w-full">
                    Be om ny lenke
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password">Nytt passord</Label>
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
                <div>
                  <Label htmlFor="confirmPassword">Bekreft passord</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Oppdaterer...' : 'Oppdater passord'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
