import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getDailyMetrics } from '@/lib/client-metrics'
import { ProgressionView } from './progression-view'

export default async function ProgressionPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify coach–client relationship
  const { data: rel } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', user!.id)
    .eq('client_id', clientId)
    .single()

  if (!rel) notFound()

  const data = await getDailyMetrics(supabase, clientId)

  return <ProgressionView data={data} />
}
