import { createClient } from '@/lib/supabase/server'
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
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan')
      .eq('id', user.id)
      .single()
    currentPlan = profile?.subscription_plan ?? 'free'
  }

  return <PricingView isLoggedIn={!!user} currentPlan={currentPlan} checkoutStatus={checkout ?? null} />
}
