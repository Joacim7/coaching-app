'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function LoginForm() {
  const router = useRouter()

  const next = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('next') ?? '/dashboard'
    : '/dashboard'
  const resetSuccess = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('reset') === 'success'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Created lazily here (not at module/render time) so this page never
    // needs NEXT_PUBLIC_SUPABASE_URL/ANON_KEY during prerendering/build —
    // this only ever runs client-side, on an actual submit.
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Clients can have a real auth account too (for the mobile app) — make
    // sure someone who mistakenly logs in here with client credentials
    // can't reach the coach dashboard.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role === 'client') {
      await supabase.auth.signOut()
      setError('Dette er coach-dashboardet. Last ned appen for å logge inn som klient.')
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          <Image
            src="/nova-performance-logo.png"
            alt="Nova Performance"
            width={320}
            height={107}
            className="object-contain"
            priority
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Logg inn</CardTitle>
            <CardDescription>Logg inn på coach-dashboardet ditt</CardDescription>
          </CardHeader>
          <CardContent>
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
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Passord</Label>
                  <Link href="/auth/forgot-password" className="text-sm text-[#2d8653] hover:underline">
                    Glemt passord?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              {resetSuccess && !error && (
                <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                  Passordet er oppdatert. Logg inn med det nye passordet ditt.
                </p>
              )}
              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Logger inn...' : 'Logg inn'}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-600">
              Ingen konto?{' '}
              <Link href="/auth/register" className="text-[#2d8653] hover:underline font-medium">
                Registrer deg
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
