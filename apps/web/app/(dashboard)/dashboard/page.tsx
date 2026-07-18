import { createClient } from '@/lib/supabase/server'
import { Users, ClipboardCheck, TrendingUp, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

const MOOD = ['😢', '😞', '😐', '🙂', '😄']

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: clientRows } = await supabase
    .from('coach_clients')
    .select('client_id')
    .eq('coach_id', user!.id)

  const clientIds = (clientRows ?? []).map(r => r.client_id)
  const ids = clientIds.length ? clientIds : ['00000000-0000-0000-0000-000000000000']

  const [{ data: recentCheckins }, { data: profile }] = await Promise.all([
    supabase
      .from('checkins')
      .select('id, type, mood, created_at, profile:profiles!client_id(full_name)')
      .in('client_id', ids)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user!.id)
      .single(),
  ])

  const clientCount = clientIds.length

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1a5c3a]">
          Hei, {profile?.full_name?.split(' ')[0] ?? 'Coach'} 👋
        </h1>
        <p className="text-gray-500 mt-1">Her er en oversikt over dagen din</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-[#cdeee3] rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-[#2d8653]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Aktive klienter</p>
              <p className="text-2xl font-bold text-gray-900">{clientCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-[#ebf5ef] rounded-xl flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-[#1a5c3a]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Check-ins i dag</p>
              <p className="text-2xl font-bold text-gray-900">
                {recentCheckins?.filter(c =>
                  new Date(c.created_at).toDateString() === new Date().toDateString()
                ).length ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-[#cdeee3] rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-[#2d8653]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Check-ins denne uken</p>
              <p className="text-2xl font-bold text-gray-900">
                {recentCheckins?.filter(c => {
                  const weekAgo = new Date()
                  weekAgo.setDate(weekAgo.getDate() - 7)
                  return new Date(c.created_at) > weekAgo
                }).length ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Siste check-ins
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!recentCheckins?.length ? (
            <p className="text-gray-500 text-sm py-4 text-center">
              Ingen check-ins ennå. Legg til klienter og lag check-in maler.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentCheckins.map(checkin => {
                const p = Array.isArray(checkin.profile) ? checkin.profile[0] : checkin.profile
                return (
                  <div key={checkin.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {(p as any)?.full_name ?? 'Klient'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {checkin.type === 'daily' ? 'Daglig' : 'Ukentlig'} check-in ·{' '}
                        {new Date(checkin.created_at).toLocaleDateString('nb-NO')}
                      </p>
                    </div>
                    {checkin.mood != null && (
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{MOOD[checkin.mood - 1]}</span>
                        <span className="text-xs text-gray-500">{checkin.mood}/5</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {!!recentCheckins?.length && (
            <Link href="/clients" className="block mt-4 text-center text-sm text-[#2d8653] hover:underline">
              Se alle klienter →
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
