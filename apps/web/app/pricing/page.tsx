import { createClient } from '@/lib/supabase/server'
import { isExemptFromPaywall } from '@/lib/paywall'
import { PricingView } from './pricing-view'

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const { checkout } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let currentPlan: string | null = null
  let mustSubscribe = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan')
      .eq('id', user.id)
      .single()
    currentPlan = profile?.subscription_plan ?? 'free'
    mustSubscribe = currentPlan === 'free' && !(await isExemptFromPaywall(supabase, user.id))
  }

  return (
    <PricingView
      isLoggedIn={!!user}
      currentPlan={currentPlan}
      checkoutStatus={checkout ?? null}
      mustSubscribe={mustSubscribe}
    />
  )
}
