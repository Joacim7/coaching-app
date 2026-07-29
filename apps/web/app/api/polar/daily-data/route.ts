import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUserId } from '@/lib/polar'

const BASE = 'https://www.polaraccesslink.com'

// Field names below (resource-uri, activity-log, active-steps, light-sleep,
// deep-sleep, rem-sleep) are reverse-engineered from Polar's official
// example client and third-party OSS clients built against their OpenAPI
// spec, since AccessLink's own docs page isn't fully accessible here. If
// Polar's real JSON differs, this is the place to adjust.

export async function GET(req: Request) {
  const admin  = createAdminClient()
  const userId = await getAuthedUserId(req, admin)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: conn } = await admin
    .from('polar_connections')
    .select('polar_user_id, access_token')
    .eq('user_id', userId)
    .maybeSingle()

  if (!conn) return NextResponse.json({ error: 'Not connected' }, { status: 404 })

  const headers = { Authorization: `Bearer ${conn.access_token}`, Accept: 'application/json' }

  const [steps, sleepHours] = await Promise.all([
    fetchTodaySteps(conn.polar_user_id, headers),
    fetchLastNightSleepHours(conn.polar_user_id, headers),
  ])

  return NextResponse.json({ steps, sleepHours })
}

async function fetchTodaySteps(
  polarUserId: string,
  headers: Record<string, string>
): Promise<number | null> {
  let transactionUrl: string | undefined

  try {
    const today = new Date().toISOString().slice(0, 10)

    const createRes = await fetch(`${BASE}/v3/users/${polarUserId}/activity-transactions`, {
      method: 'POST',
      headers,
    })

    // 204 = nothing new to sync since the last commit — not an error.
    if (createRes.status === 204) return null
    if (!createRes.ok) {
      console.warn('[polar] create activity transaction failed:', createRes.status)
      return null
    }

    const created = await createRes.json()
    transactionUrl = created['resource-uri']
    if (!transactionUrl) return null

    const listRes = await fetch(transactionUrl, { headers })
    if (!listRes.ok) return null
    const { 'activity-log': activityUrls } = await listRes.json()

    for (const url of (activityUrls ?? []) as string[]) {
      const summaryRes = await fetch(url, { headers })
      if (!summaryRes.ok) continue
      const summary = await summaryRes.json()
      if (summary.date === today && typeof summary['active-steps'] === 'number') {
        return summary['active-steps']
      }
    }
    return null
  } catch (err) {
    console.warn("[polar] failed to fetch today's steps:", err)
    return null
  } finally {
    // Always commit a created transaction — otherwise it stays open and
    // blocks the next create call from ever returning new data again.
    if (transactionUrl) {
      await fetch(transactionUrl, { method: 'PUT', headers }).catch(() => {})
    }
  }
}

async function fetchLastNightSleepHours(
  polarUserId: string,
  headers: Record<string, string>
): Promise<number | null> {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const res = await fetch(`${BASE}/v3/users/${polarUserId}/sleep/${today}`, { headers })
    if (res.status === 404) return null
    if (!res.ok) {
      console.warn('[polar] sleep fetch failed:', res.status)
      return null
    }
    const night = await res.json()
    const seconds = (night['light-sleep'] ?? 0) + (night['deep-sleep'] ?? 0) + (night['rem-sleep'] ?? 0)
    return seconds > 0 ? Math.round((seconds / 3600) * 10) / 10 : null
  } catch (err) {
    console.warn('[polar] failed to fetch sleep hours:', err)
    return null
  }
}
