import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { FinanceView } from './finance-view'

export default async function FinancePage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rel } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', user!.id)
    .eq('client_id', clientId)
    .single()

  if (!rel) notFound()

  const { data: contract } = await supabase
    .from('client_contracts')
    .select('id, monthly_price, duration_months, start_date')
    .eq('coach_id', user!.id)
    .eq('client_id', clientId)
    .single()

  return (
    <FinanceView
      clientId={clientId}
      coachId={user!.id}
      initialContract={contract ?? null}
    />
  )
}
