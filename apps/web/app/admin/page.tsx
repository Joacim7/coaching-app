import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { planBySlug, type PlanSlug } from '@/lib/plans'
import { isDeletableTestCoach } from '@/lib/adminTestCoach'
import { DeleteCoachButton } from './delete-coach-button'
import { Users, UserCircle2, Building2, Wallet } from 'lucide-react'

// Hard-restricted to a single platform-owner account — not a role check,
// deliberately just this one id, so access can't accidentally widen if
// someone else's profile.role or org membership ever changes.
const ADMIN_COACH_ID = '001bde00-57e8-4918-8c53-f596e0efbddb'

const REVENUE_PLAN_SLUGS: PlanSlug[] = ['starter', 'pro', 'unlimited']

async function getAllUserEmails(admin: ReturnType<typeof createAdminClient>): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let page = 1
  const perPage = 1000
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error || !data) break
    for (const u of data.users) if (u.email) map.set(u.id, u.email)
    if (data.users.length < perPage) break
    page++
  }
  return map
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtKr(n: number) {
  return `${n.toLocaleString('nb-NO')} kr`
}

const PLAN_BADGE: Record<PlanSlug, string> = {
  free: 'bg-gray-100 text-gray-500',
  starter: 'bg-amber-50 text-amber-700',
  pro: 'bg-[#ebf5ef] text-[#1a5c3a]',
  unlimited: 'bg-[#1a5c3a] text-white',
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  if (user.id !== ADMIN_COACH_ID) notFound()

  const admin = createAdminClient()

  const [
    { data: coaches },
    { data: orgMembers },
    { data: orgs },
    { data: coachClients },
    emailMap,
  ] = await Promise.all([
    admin.from('profiles').select('id, full_name, created_at, subscription_plan').eq('role', 'coach'),
    admin.from('org_members').select('user_id, org_id'),
    admin.from('organizations').select('id, name, subscription_plan'),
    admin.from('coach_clients').select('client_id, coach_id, status'),
    getAllUserEmails(admin),
  ])

  // A raw count of profiles.role = 'client' also picks up orphaned rows
  // that were never (or are no longer) linked to any coach — leftover test
  // data, abandoned onboarding attempts, clients whose coach was deleted.
  // Counting distinct client_ids that actually appear in coach_clients
  // reflects real clients on the platform instead.
  const totalClients = new Set((coachClients ?? []).map(cc => cc.client_id)).size

  const orgById = new Map((orgs ?? []).map(o => [o.id, o]))
  const orgIdByCoach = new Map((orgMembers ?? []).map(m => [m.user_id, m.org_id]))

  const activeClientCountByCoach = new Map<string, number>()
  for (const cc of coachClients ?? []) {
    if (cc.status === 'inactive') continue
    activeClientCountByCoach.set(cc.coach_id, (activeClientCountByCoach.get(cc.coach_id) ?? 0) + 1)
  }

  const allCoaches = coaches ?? []
  const standaloneCount = allCoaches.filter(c => !orgIdByCoach.has(c.id)).length
  const orgCount = allCoaches.length - standaloneCount

  const planCounts: Record<PlanSlug, number> = { free: 0, starter: 0, pro: 0, unlimited: 0 }
  for (const c of allCoaches) {
    const slug = (c.subscription_plan ?? 'free') as PlanSlug
    if (slug in planCounts) planCounts[slug]++
  }
  const totalMrr = REVENUE_PLAN_SLUGS.reduce((sum, slug) => sum + planCounts[slug] * planBySlug(slug).priceKr, 0)

  const rows = [...allCoaches].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="[background:linear-gradient(to_right,#1a5c3a,#2d8653)] text-white">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <h1 className="text-2xl font-bold">Nova Performance — Admin</h1>
          <p className="text-[#cdeee3] text-sm mt-1">Plattformoversikt for coacher og klienter</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">

        {/* Top stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Coacher totalt</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{allCoaches.length}</p>
            <p className="text-xs text-gray-500 mt-1">
              {standaloneCount} frittstående · {orgCount} i organisasjon
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <UserCircle2 className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Klienter totalt</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalClients}</p>
            <p className="text-xs text-gray-500 mt-1">Klienter tilknyttet en coach</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Wallet className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">MRR (individuelle planer)</span>
            </div>
            <p className="text-3xl font-bold text-[#1a5c3a]">{fmtKr(totalMrr)}</p>
            <p className="text-xs text-gray-500 mt-1">Starter, Growth og Pro — ekskl. org-abonnement</p>
          </div>
        </div>

        {/* Revenue overview */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="text-sm font-bold text-gray-900">Inntektsoversikt per plan</h2>
            <p className="text-xs text-gray-400 mt-0.5">Antall coacher og estimert månedlig inntekt (MRR) per abonnement</p>
          </div>
          <div className="divide-y divide-gray-50">
            {REVENUE_PLAN_SLUGS.map(slug => {
              const plan = planBySlug(slug)
              const count = planCounts[slug]
              const revenue = count * plan.priceKr
              const pct = totalMrr > 0 ? (revenue / totalMrr) * 100 : 0
              return (
                <div key={slug} className="px-6 py-4 flex items-center gap-4">
                  <span className={`w-20 shrink-0 text-center text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_BADGE[slug]}`}>
                    {plan.displayName}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-gray-600">{count} coach{count === 1 ? '' : 'er'}</span>
                      <span className="font-semibold text-gray-900">{fmtKr(revenue)} / mnd</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#2d8653] rounded-full transition-all" style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }} />
                    </div>
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs text-gray-400">{fmtKr(plan.priceKr)}/mnd</span>
                </div>
              )
            })}
          </div>
          <div className="px-6 py-3 bg-gray-50 flex items-center justify-between text-sm">
            <span className="text-gray-500">Totalt MRR</span>
            <span className="font-bold text-[#1a5c3a]">{fmtKr(totalMrr)}</span>
          </div>
        </div>

        {/* Coaches table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-bold text-gray-900">Alle coacher ({rows.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <th className="px-6 py-3">Navn</th>
                  <th className="px-6 py-3">E-post</th>
                  <th className="px-6 py-3">Plan</th>
                  <th className="px-6 py-3">Organisasjon</th>
                  <th className="px-6 py-3 text-right">Aktive klienter</th>
                  <th className="px-6 py-3 text-right">Registrert</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(coach => {
                  const orgId = orgIdByCoach.get(coach.id)
                  const org = orgId ? orgById.get(orgId) : null
                  const slug = (coach.subscription_plan ?? 'free') as PlanSlug
                  const plan = planBySlug(slug)
                  const email = emailMap.get(coach.id) ?? null
                  const canDelete = coach.id !== ADMIN_COACH_ID && isDeletableTestCoach(email)
                  return (
                    <tr key={coach.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-gray-900 whitespace-nowrap">
                        {coach.full_name ?? '—'}
                        {coach.id === ADMIN_COACH_ID && (
                          <span className="ml-2 text-[10px] font-semibold text-[#2d8653] bg-[#ebf5ef] px-1.5 py-0.5 rounded">DEG</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-gray-500">{email ?? '—'}</td>
                      <td className="px-6 py-3.5">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${PLAN_BADGE[slug]}`}>
                          {plan.displayName}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-gray-500 whitespace-nowrap">
                        {org?.name ?? <span className="text-gray-300">–</span>}
                      </td>
                      <td className="px-6 py-3.5 text-right font-semibold text-gray-900">
                        {activeClientCountByCoach.get(coach.id) ?? 0}
                      </td>
                      <td className="px-6 py-3.5 text-right text-gray-500 whitespace-nowrap">{fmtDate(coach.created_at)}</td>
                      <td className="px-6 py-3.5 text-right">
                        {canDelete && <DeleteCoachButton coachId={coach.id} coachName={coach.full_name ?? email ?? 'denne coachen'} />}
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400">Ingen coacher funnet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
