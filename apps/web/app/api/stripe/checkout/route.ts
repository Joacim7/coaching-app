import { createClient } from '@/lib/supabase/server'
import { getStripe, STRIPE_PRICE_ENV } from '@/lib/stripe'
import { NextResponse } from 'next/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const PAID_PLANS = ['starter', 'pro', 'unlimited'] as const
type PaidPlan = typeof PAID_PLANS[number]

function isPaidPlan(value: unknown): value is PaidPlan {
  return typeof value === 'string' && (PAID_PLANS as readonly string[]).includes(value)
}

export async function POST(req: Request) {
  const { plan } = await req.json()

  if (!isPaidPlan(plan)) {
    return NextResponse.json({ error: 'Ugyldig plan' }, { status: 400 })
  }

  const priceId = STRIPE_PRICE_ENV[plan]
  if (!priceId) {
    console.error(`[stripe/checkout] Missing Stripe price env var for plan "${plan}"`)
    return NextResponse.json({ error: 'Denne planen er ikke tilgjengelig akkurat nå' }, { status: 500 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, stripe_customer_id')
    .eq('id', user.id)
    .single()

  const stripe = getStripe()

  let customerId = profile?.stripe_customer_id ?? null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email ?? undefined,
      name: profile?.full_name ?? undefined,
      metadata: { coachId: user.id },
    })
    customerId = customer.id
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { coachId: user.id, plan } },
    metadata: { coachId: user.id, plan },
    // /api/stripe/confirm verifies the session and syncs subscription_plan
    // synchronously before landing on /dashboard — the webhook also does
    // this, but asynchronously, which could otherwise race the redirect and
    // bounce a coach who just paid straight back to /pricing.
    success_url: `${APP_URL}/api/stripe/confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/pricing?checkout=canceled`,
  })

  if (!session.url) {
    return NextResponse.json({ error: 'Kunne ikke starte betaling' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
