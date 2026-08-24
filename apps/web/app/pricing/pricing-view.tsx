'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DISPLAY_PLANS, type PlanSlug } from '@/lib/plans'

interface PricingViewProps {
  isLoggedIn: boolean
  currentPlan: string | null
  checkoutStatus: string | null
  mustSubscribe: boolean
}

export function PricingView({ isLoggedIn, currentPlan, checkoutStatus, mustSubscribe }: PricingViewProps) {
  const [loadingPlan, setLoadingPlan] = useState<PlanSlug | null>(null)
  const [error, setError] = useState('')

  async function handleUpgrade(plan: PlanSlug) {
    setError('')
    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error ?? 'Noe gikk galt')
        setLoadingPlan(null)
        return
      }
      window.location.assign(result.url)
    } catch {
      setError('Noe gikk galt — prøv igjen')
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">Priser</h1>
          <p className="text-gray-500 mt-2">
            {mustSubscribe ? 'Velg en plan for å komme i gang' : 'Velg planen som passer antall klienter du jobber med'}
          </p>
        </div>

        {checkoutStatus === 'canceled' && (
          <div className="max-w-md mx-auto mb-8 text-sm text-center text-gray-600 bg-white border border-gray-200 px-4 py-3 rounded-lg">
            Betaling avbrutt — ingenting ble trukket.
          </div>
        )}
        {error && (
          <div className="max-w-md mx-auto mb-8 text-sm text-center text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch max-w-4xl mx-auto">
          {DISPLAY_PLANS.map(plan => {
            const isCurrent = isLoggedIn && currentPlan === plan.slug
            const isLoading = loadingPlan === plan.slug

            return (
              <Card
                key={plan.slug}
                className={`h-full flex flex-col ${isCurrent ? 'ring-2 ring-[#2d8653]' : ''}`}
              >
                <CardHeader>
                  {isCurrent && (
                    <span className="inline-block text-xs font-medium text-[#2d8653] bg-[#ebf5ef] px-2 py-0.5 rounded-full mb-1 w-fit">
                      Din nåværende plan
                    </span>
                  )}
                  <CardTitle>{plan.displayName}</CardTitle>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold text-gray-900">{plan.priceKr}</span>
                    <span className="text-sm text-gray-400">kr/mnd</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <ul className="space-y-2 mb-6">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-[#2d8653] flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button variant="outline" disabled className="w-full">
                      Aktiv plan
                    </Button>
                  ) : isLoggedIn ? (
                    <Button
                      className="w-full"
                      disabled={isLoading}
                      onClick={() => handleUpgrade(plan.slug)}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {isLoading ? 'Starter betaling...' : 'Oppgrader'}
                    </Button>
                  ) : (
                    <Link href="/auth/login" className="block">
                      <Button className="w-full">Logg inn for å oppgradere</Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
