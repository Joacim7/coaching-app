import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrganizationView } from './organization-view'

export const metadata = { title: 'Organisasjon' }

export default async function OrganizationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Find current user's org membership
  const { data: membership } = await supabase
    .from('org_members')
    .select('role, org_id, organizations(id, name, max_coaches, created_at, created_by)')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return <OrganizationView org={null} role={null} stats={null} userId={user.id} />
  }

  const org = membership.organizations as unknown as {
    id: string; name: string; max_coaches: number; created_at: string; created_by: string
  }

  // Parallel stats
  const [coachesRes, invitationsRes, clientsRes] = await Promise.all([
    supabase
      .from('org_members')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id),
    supabase
      .from('org_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .eq('status', 'pending'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'client'),
  ])

  const stats = {
    coachCount:         coachesRes.count    ?? 0,
    maxCoaches:         org.max_coaches,
    totalClients:       clientsRes.count    ?? 0,
    pendingInvitations: invitationsRes.count ?? 0,
  }

  return (
    <OrganizationView
      org={org}
      role={membership.role as 'admin' | 'coach'}
      stats={stats}
      userId={user.id}
    />
  )
}
