'use client'

import { ClipboardList, Calendar } from 'lucide-react'
import { RecentCheckins, type CheckinRow } from '../recent-checkins'

export function CheckinsView({ checkins, clientId }: { checkins: CheckinRow[]; clientId: string }) {
  const weekly = checkins.filter(c => c.type === 'weekly')
  const daily  = checkins.filter(c => c.type === 'daily')

  return (
    <div className="space-y-6">
      {/* ── Ukentlig oversikt ─────────────────────────────────── */}
      <section className="border border-gray-100 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-[#f9fefb]">
          <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#2d8653]" />
            Ukentlig oversikt
          </h2>
          <span className="text-xs text-gray-400">{weekly.length} {weekly.length === 1 ? 'check-in' : 'check-ins'}</span>
        </div>
        {weekly.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Ingen ukentlige check-ins ennå</p>
          </div>
        ) : (
          <RecentCheckins checkins={weekly} clientId={clientId} />
        )}
      </section>

      {/* ── Daglige check-ins ──────────────────────────────────── */}
      <section className="border border-gray-100 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-gray-400" />
            Daglige check-ins
          </h2>
          <span className="text-xs text-gray-400">{daily.length} {daily.length === 1 ? 'check-in' : 'check-ins'}</span>
        </div>
        {daily.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-400">Ingen daglige check-ins ennå</p>
          </div>
        ) : (
          <RecentCheckins checkins={daily} clientId={clientId} />
        )}
      </section>
    </div>
  )
}
