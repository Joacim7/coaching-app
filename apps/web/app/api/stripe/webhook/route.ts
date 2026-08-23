import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, planSlugForPriceId } from '@/lib/stripe'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  const rawBody = await req.text()

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? '', webhookSecret)
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const coachId = session.client_reference_id ?? session.metadata?.coachId
      const plan = session.metadata?.plan
      if (!coachId || !plan) {
        console.error('[stripe/webhook] checkout.session.completed missing coachId/plan metadata')
        break
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_plan: plan,
          stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
          stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null,
        })
        .eq('id', coachId)

      if (error) console.error('[stripe/webhook] profile update failed:', error.message)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const coachId = await resolveCoachId(supabase, subscription)
      if (!coachId) break

      const cancelled = ['canceled', 'unpaid', 'incomplete_expired'].includes(subscription.status)
      const priceId = subscription.items.data[0]?.price?.id
      const plan = cancelled ? 'free' : (priceId ? planSlugForPriceId(priceId) : null)

      if (!plan) {
        console.error(`[stripe/webhook] Could not resolve plan for subscription ${subscription.id} (price ${priceId})`)
        break
      }

      const { error } = await supabase
        .from('profiles')
        .update({ subscription_plan: plan, stripe_subscription_id: subscription.id })
        .eq('id', coachId)

      if (error) console.error('[stripe/webhook] profile update failed:', error.message)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const coachId = await resolveCoachId(supabase, subscription)
      if (!coachId) break

      const { error } = await supabase
        .from('profiles')
        .update({ subscription_plan: 'free', stripe_subscription_id: null })
        .eq('id', coachId)

      if (error) console.error('[stripe/webhook] profile update failed:', error.message)
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveCoachId(supabase: any, subscription: Stripe.Subscription): Promise<string | null> {
  if (subscription.metadata?.coachId) return subscription.metadata.coachId

  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
  if (!customerId) return null

  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  return data?.id ?? null
}
