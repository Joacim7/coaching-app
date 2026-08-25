import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, isStripeTestMode, planSlugForPriceId, orgPlanSlugForPriceId } from '@/lib/stripe'
import { orgPlanBySlug } from '@/lib/orgPlans'
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
  // Test and live customers/subscriptions are entirely separate in Stripe,
  // and this DB is shared with production — a test-mode id must never
  // overwrite a real one. subscription_plan still updates either way, since
  // that's exactly what local testing is meant to verify.
  const testMode = isStripeTestMode()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session

      if (session.metadata?.type === 'org_create') {
        const createdBy = session.metadata?.createdBy
        const orgName = session.metadata?.orgName
        const planInfo = orgPlanBySlug(session.metadata?.plan)
        if (!createdBy || !orgName || !planInfo) {
          console.error('[stripe/webhook] org_create missing createdBy/orgName/plan metadata')
          break
        }

        const { data: org, error } = await supabase.rpc('create_organization_for_user', {
          p_user_id: createdBy,
          p_name: orgName,
          p_plan: planInfo.slug,
          p_max_coaches: planInfo.maxCoaches,
        })

        // "Already in an organization" means org-confirm (the synchronous
        // redirect handler) already created it — not an error, just a no-op.
        if (error) {
          if (!error.message.includes('Already in an organization')) {
            console.error('[stripe/webhook] org creation failed:', error.message)
          }
          break
        }

        const newOrgId = (org as { id: string } | null)?.id
        if (newOrgId && !testMode) {
          await supabase
            .from('organizations')
            .update({
              stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
              stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null,
            })
            .eq('id', newOrgId)
        }
        break
      }

      if (session.metadata?.type === 'org') {
        const orgId = session.metadata?.orgId
        const planInfo = orgPlanBySlug(session.metadata?.plan)
        if (!orgId || !planInfo) {
          console.error('[stripe/webhook] org checkout.session.completed missing orgId/plan metadata')
          break
        }

        const { error } = await supabase
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

        if (error) console.error('[stripe/webhook] organization update failed:', error.message)
        break
      }

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
          ...(testMode ? {} : {
            stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
            stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null,
          }),
        })
        .eq('id', coachId)

      if (error) console.error('[stripe/webhook] profile update failed:', error.message)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription

      if (subscription.metadata?.type === 'org') {
        const orgId = await resolveOrgId(supabase, subscription)
        if (!orgId) break

        const cancelled = ['canceled', 'unpaid', 'incomplete_expired'].includes(subscription.status)
        const priceId = subscription.items.data[0]?.price?.id
        const planInfo = cancelled ? null : orgPlanBySlug(priceId ? orgPlanSlugForPriceId(priceId) : null)

        if (!cancelled && !planInfo) {
          console.error(`[stripe/webhook] Could not resolve org plan for subscription ${subscription.id} (price ${priceId})`)
          break
        }

        const { error } = await supabase
          .from('organizations')
          .update({
            subscription_plan: cancelled ? null : planInfo!.slug,
            ...(cancelled ? {} : { max_coaches: planInfo!.maxCoaches }),
            ...(testMode ? {} : { stripe_subscription_id: cancelled ? null : subscription.id }),
          })
          .eq('id', orgId)

        if (error) console.error('[stripe/webhook] organization update failed:', error.message)
        break
      }

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
        .update({ subscription_plan: plan, ...(testMode ? {} : { stripe_subscription_id: subscription.id }) })
        .eq('id', coachId)

      if (error) console.error('[stripe/webhook] profile update failed:', error.message)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription

      if (subscription.metadata?.type === 'org') {
        const orgId = await resolveOrgId(supabase, subscription)
        if (!orgId) break

        const { error } = await supabase
          .from('organizations')
          .update({ subscription_plan: null, ...(testMode ? {} : { stripe_subscription_id: null }) })
          .eq('id', orgId)

        if (error) console.error('[stripe/webhook] organization update failed:', error.message)
        break
      }

      const coachId = await resolveCoachId(supabase, subscription)
      if (!coachId) break

      const { error } = await supabase
        .from('profiles')
        .update({ subscription_plan: 'free', ...(testMode ? {} : { stripe_subscription_id: null }) })
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveOrgId(supabase: any, subscription: Stripe.Subscription): Promise<string | null> {
  if (subscription.metadata?.orgId) return subscription.metadata.orgId

  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
  if (!customerId) return null

  const { data } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  return data?.id ?? null
}
