import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import SettingsView from './settings-view'

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft:         'Utkast',
  open:          'Venter',
  paid:          'Betalt',
  uncollectible: 'Ikke betalt',
  void:          'Kansellert',
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, phone, weight_unit, distance_unit, language, subscription_plan, stripe_customer_id, stripe_subscription_id')
    .eq('id', user!.id)
    .single()

  // Renewal date and invoices are live Stripe state, not mirrored in our own
  // DB — fetched here so the Abonnement/Fakturaer sections always reflect
  // what Stripe actually has, not a snapshot that can drift out of sync.
  let renewalDateIso: string | null = null
  const invoices: {
    id: string
    dateIso: string
    amountKr: number
    status: string
    downloadUrl: string | null
  }[] = []

  if (profile?.stripe_subscription_id || profile?.stripe_customer_id) {
    try {
      const stripe = getStripe()

      if (profile.stripe_subscription_id) {
        const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id)
        // Billing period now lives on the subscription item, not the
        // subscription itself (moved there in a recent Stripe API version).
        const periodEnd = subscription.items.data[0]?.current_period_end
        if (periodEnd) renewalDateIso = new Date(periodEnd * 1000).toISOString()
      }

      if (profile.stripe_customer_id) {
        const list = await stripe.invoices.list({ customer: profile.stripe_customer_id, limit: 12 })
        for (const inv of list.data) {
          invoices.push({
            id:          inv.id ?? '',
            dateIso:     new Date(inv.created * 1000).toISOString(),
            amountKr:    inv.amount_paid / 100,
            status:      INVOICE_STATUS_LABELS[inv.status ?? ''] ?? inv.status ?? '',
            downloadUrl: inv.invoice_pdf ?? null,
          })
        }
      }
    } catch (err) {
      // A stale/cross-mode id (e.g. a live id while running in test mode)
      // fails here rather than crashing the page — the sections below just
      // fall back to their empty states.
      console.error('[settings] Stripe billing fetch failed:', err instanceof Error ? err.message : err)
    }
  }

  return (
    <SettingsView
      userId={user!.id}
      email={user!.email ?? ''}
      initialProfile={{
        full_name:     profile?.full_name     ?? '',
        avatar_url:    profile?.avatar_url    ?? null,
        phone:         profile?.phone         ?? '',
        weight_unit:   (profile?.weight_unit  ?? 'kg') as 'kg' | 'lb',
        distance_unit: (profile?.distance_unit ?? 'km') as 'km' | 'mi',
        language:      profile?.language      ?? 'nb',
      }}
      billing={{
        planSlug:         profile?.subscription_plan ?? 'free',
        hasStripeCustomer: !!profile?.stripe_customer_id,
        renewalDateIso,
        invoices,
      }}
    />
  )
}
