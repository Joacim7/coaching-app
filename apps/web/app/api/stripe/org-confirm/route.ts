import { createClient } from '@/lib/supabase/server'
import { getStripe, isStripeTestMode } from '@/lib/stripe'
import { orgPlanBySlug } from '@/lib/orgPlans'
import { NextResponse } from 'next/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Stripe Checkout redirects the admin's browser here right after payment for
// an org plan. The webhook (/api/stripe/webhook) is the source of truth
// long-term, but it fires asynchronously — this route verifies the session
// and applies the same update synchronously first, so /organization is
// guaranteed correct by the time the browser gets there.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.redirect(`${APP_URL}/organization`)
  }

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.status === 'complete' || session.payment_status === 'paid') {
      const orgId = session.metadata?.orgId
      const planInfo = orgPlanBySlug(session.metadata?.plan)

      if (orgId && planInfo) {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        // Only apply if this really is an admin of the org that owns the
        // session — the webhook (service-role) remains the source of truth
        // otherwise.
        const { data: membership } = user
          ? await supabase.from('org_members').select('role').eq('org_id', orgId).eq('user_id', user.id).single()
          : { data: null }

        if (membership?.role === 'admin') {
          // Test-mode customer/subscription ids must never overwrite a real
          // one in this shared DB — but subscription_plan is exactly what's
          // being tested, so that still updates either way.
          const testMode = isStripeTestMode()
          await supabase
            .from('organizations')
            .update({
              subscription_plan: planInfo.slug,
              max_coaches: planInfo.maxCoaches,
              ...(testMode ? {} : {
                stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
                stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null,
              }),
            })
            .eq('id', orgId)
        }
      }
    }
  } catch (err) {
    console.error('[stripe/org-confirm] Failed to verify session:', err instanceof Error ? err.message : err)
  }

  return NextResponse.redirect(`${APP_URL}/organization`)
}
