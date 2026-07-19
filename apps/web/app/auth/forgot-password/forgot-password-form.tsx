'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dumbbell } from 'lucide-react'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Created lazily here (not at module/render time) so this page never
    // needs NEXT_PUBLIC_SUPABASE_URL/ANON_KEY during prerendering/build —
    // this only ever runs client-side, on an actual submit.
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    setLoading(false)

    // Supabase returns success here even for unknown emails (by design, to
    // avoid leaking which addresses have accounts), so always show the same
    // confirmation state unless the request itself failed (e.g. rate limit).
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
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
            <CardTitle>Glemt passord</CardTitle>
            <CardDescription>
              {sent
                ? 'Sjekk innboksen din for videre instruksjoner'
                : 'Skriv inn e-posten din, så sender vi deg en lenke for å tilbakestille passordet'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <p className="text-sm text-gray-600">
                Hvis {email} er registrert hos oss, har vi sendt en e-post med en lenke for å
                tilbakestille passordet.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">E-post</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="din@epost.no"
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sender...' : 'Send tilbakestillingslenke'}
                </Button>
              </form>
            )}
            <p className="mt-4 text-center text-sm text-gray-600">
              <Link href="/auth/login" className="text-[#2d8653] hover:underline font-medium">
                Tilbake til innlogging
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
