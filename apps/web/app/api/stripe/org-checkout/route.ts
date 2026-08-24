import { createClient } from '@/lib/supabase/server'
import { getStripe, isStripeTestMode, STRIPE_ORG_PRICE_ENV } from '@/lib/stripe'
import { orgPlanBySlug } from '@/lib/orgPlans'
import { NextResponse } from 'next/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function POST(req: Request) {
  const { orgId, plan } = await req.json()
  const planInfo = orgPlanBySlug(plan)

  if (!orgId || !planInfo) {
    return NextResponse.json({ error: 'Ugyldig plan' }, { status: 400 })
  }

  const priceId = STRIPE_ORG_PRICE_ENV[planInfo.slug]
  if (!priceId) {
    console.error(`[stripe/org-checkout] Missing Stripe price env var for org plan "${planInfo.slug}"`)
    return NextResponse.json({ error: 'Denne planen er ikke tilgjengelig akkurat nå' }, { status: 500 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 })
  }

  // Only the org's own admin can choose/pay for a plan.
  const { data: membership } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [{ data: org }, { data: profile }] = await Promise.all([
    supabase.from('organizations').select('stripe_customer_id').eq('id', orgId).single(),
    supabase.from('profiles').select('email, full_name').eq('id', user.id).single(),
  ])

  const stripe = getStripe()
  const testMode = isStripeTestMode()

  // Test and live customers are entirely separate in Stripe, and this DB is
  // shared with production — a test-mode id must never overwrite a real one.
  let customerId = testMode ? null : (org?.stripe_customer_id ?? null)
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email ?? undefined,
      name: profile?.full_name ?? undefined,
      metadata: { orgId },
    })
    customerId = customer.id
    if (!testMode) {
      await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', orgId)
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: orgId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { orgId, plan: planInfo.slug, type: 'org' } },
    metadata: { orgId, plan: planInfo.slug, type: 'org' },
    // /api/stripe/org-confirm verifies the session and syncs the org's plan
    // synchronously before landing on /organization — the webhook also does
    // this, but asynchronously, which could otherwise race the redirect.
    success_url: `${APP_URL}/api/stripe/org-confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/organization?checkout=canceled`,
  })

  if (!session.url) {
    return NextResponse.json({ error: 'Kunne ikke starte betaling' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
