'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'

export default function DeleteAccountPage() {
  const [email, setEmail]     = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [sent, setSent]       = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!confirmed) {
      setError('Du må bekrefte at du ønsker å slette kontoen for å fortsette')
      return
    }

    setLoading(true)

    const res = await fetch('/api/account-deletion', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: email.trim() }),
    })

    const result = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) {
      setError(result.error ?? 'Noe gikk galt. Prøv igjen.')
      return
    }

    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image src="/nova-performance-logo.png" alt="Nova Performance" width={180} height={60} className="object-contain" priority />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Slett konto</CardTitle>
            <CardDescription>
              {sent
                ? 'Forespørselen din er mottatt'
                : 'Send inn en forespørsel om å få slettet kontoen din og tilhørende data'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7 text-green-600" />
                </div>
                <p className="text-sm text-gray-600">
                  Vi har mottatt forespørselen din om å slette kontoen knyttet til{' '}
                  <span className="font-medium text-gray-900">{email}</span>. Vi tar kontakt på
                  denne e-postadressen for å bekrefte identiteten din før kontoen og tilhørende
                  data slettes.
                </p>
              </div>
            ) : (
              <>
                <div className="text-sm text-gray-600 space-y-2 mb-6">
                  <p>Når du ber om å få slettet kontoen din, sletter vi:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Profilen din og innloggingsopplysninger</li>
                    <li>Trenings- og kostholdsdata registrert i appen</li>
                    <li>Check-ins, meldinger og dokumenter knyttet til kontoen</li>
                  </ul>
                  <p>
                    Enkelte opplysninger kan bli oppbevart en kort periode dersom vi er lovpålagt
                    å gjøre det (f.eks. regnskapsbilag).
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email">E-post knyttet til kontoen</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="din@epost.no"
                      required
                    />
                  </div>

                  <label className="flex items-start gap-2.5 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={e => setConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#2d8653] focus:ring-[#2d8653]"
                    />
                    Jeg bekrefter at jeg ønsker å slette kontoen min og tilhørende data
                  </label>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Sender...' : 'Send forespørsel om sletting'}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
