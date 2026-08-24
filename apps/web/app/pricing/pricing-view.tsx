'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DISPLAY_PLANS, PRICING_FEATURES, planClientLimitLabel, type PlanSlug } from '@/lib/plans'

interface PricingViewProps {
  isLoggedIn: boolean
  currentPlan: string | null
  checkoutStatus: string | null
  mustSubscribe: boolean
}

export function PricingView({ isLoggedIn, currentPlan, checkoutStatus, mustSubscribe }: PricingViewProps) {
  const [loadingPlan, setLoadingPlan] = useState<PlanSlug | null>(null)
  const [error, setError] = useState('')

  // A coach only sees "Oppgrader" once they actually have a paid plan to
  // upgrade from — anyone not logged in, or logged in but still on the
  // pre-subscription 'free' state, is starting a first subscription.
  const hasActiveSubscription = isLoggedIn && currentPlan != null && currentPlan !== 'free'

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
      {/* Hero header */}
      <div className="[background:linear-gradient(to_right,#1a5c3a,#6ecfb0)] px-6 pt-16 pb-28 text-center">
        <div className="max-w-5xl mx-auto flex flex-col items-center">
          <div className="bg-white rounded-2xl px-6 py-3 shadow-lg mb-7">
            <Image
              src="/nova-performance-logo.png"
              alt="Nova Performance"
              width={160}
              height={54}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">Velg din plan</h1>
          <p className="text-white/85 mt-3 max-w-md">
            {mustSubscribe ? 'Velg en plan for å komme i gang' : 'Velg planen som passer antall klienter du jobber med'}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-16 -mt-16">
        {checkoutStatus === 'canceled' && (
          <div className="max-w-md mx-auto mb-8 text-sm text-center text-gray-600 bg-white border border-gray-200 px-4 py-3 rounded-lg shadow-sm">
            Betaling avbrutt — ingenting ble trukket.
          </div>
        )}
        {error && (
          <div className="max-w-md mx-auto mb-8 text-sm text-center text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-lg shadow-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch max-w-4xl mx-auto">
          {DISPLAY_PLANS.map(plan => {
            const isCurrent = isLoggedIn && currentPlan === plan.slug
            const isLoading = loadingPlan === plan.slug
            const highlighted = plan.popular || isCurrent

            return (
              <Card
                key={plan.slug}
                className={`relative h-full flex flex-col bg-white border-gray-100 shadow-sm ${
                  highlighted ? 'ring-2 ring-[#6ecfb0] shadow-lg' : ''
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold text-white px-3 py-1 rounded-full whitespace-nowrap shadow-md [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)]">
                    Mest populær
                  </span>
                )}
                <CardHeader className={plan.popular ? 'pt-8' : ''}>
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
                  <div>
                    <p className="min-h-[44px] flex items-center justify-center text-center text-sm font-semibold text-[#1a5c3a] bg-[#ebf5ef] rounded-lg px-3 py-2 mb-4">
                      {planClientLimitLabel(plan)}
                    </p>
                    <ul className="space-y-2.5 mb-6">
                      {PRICING_FEATURES.map(f => (
                        <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                          <Check className="w-4 h-4 text-[#2d8653] flex-shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>

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
                      {isLoading ? 'Starter betaling...' : hasActiveSubscription ? 'Oppgrader' : 'Kom i gang'}
                    </Button>
                  ) : (
                    <Link href="/auth/register" className="block">
                      <Button className="w-full">Kom i gang</Button>
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
