import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Stripe Checkout redirects the coach's browser here right after payment.
// The webhook (/api/stripe/webhook) is the source of truth for keeping
// subscription_plan in sync long-term, but it fires asynchronously — if the
// dashboard's paywall check ran before the webhook landed, a coach who just
// paid could get bounced straight back to /pricing. This route verifies the
// session and applies the same update synchronously first, so /dashboard is
// guaranteed correct by the time the browser gets there.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.redirect(`${APP_URL}/pricing`)
  }

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.status === 'complete' || session.payment_status === 'paid') {
      const coachId = session.client_reference_id ?? session.metadata?.coachId
      const plan = session.metadata?.plan

      if (coachId && plan) {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        // Only apply if this really is the coach who owns the session —
        // the webhook (service-role) remains the source of truth otherwise.
        if (user?.id === coachId) {
          await supabase
            .from('profiles')
            .update({
              subscription_plan: plan,
              stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
              stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null,
            })
            .eq('id', coachId)
        }
      }
    }
  } catch (err) {
    console.error('[stripe/confirm] Failed to verify session:', err instanceof Error ? err.message : err)
  }

  return NextResponse.redirect(`${APP_URL}/dashboard`)
}
