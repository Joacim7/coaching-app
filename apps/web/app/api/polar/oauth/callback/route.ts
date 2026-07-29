import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUserId } from '@/lib/polar'

const POLAR_CLIENT_ID     = process.env.POLAR_CLIENT_ID!
const POLAR_CLIENT_SECRET = process.env.POLAR_CLIENT_SECRET!
const REDIRECT_URI        = 'novaperformance://auth/polar'

export async function POST(req: Request) {
  const admin  = createAdminClient()
  const userId = await getAuthedUserId(req, admin)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  // Exchange the authorization code for an access token. Polar requires
  // HTTP Basic auth with the client secret here — this must only ever run
  // server-side, since the secret would be trivially extractable from the
  // compiled mobile app if embedded there instead.
  const basicAuth = Buffer.from(`${POLAR_CLIENT_ID}:${POLAR_CLIENT_SECRET}`).toString('base64')
  const tokenRes = await fetch('https://polarremote.com/v2/oauth2/token', {
    method:  'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type':  'application/x-www-form-urlencoded',
      'Accept':        'application/json',
    },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  })

  if (!tokenRes.ok) {
    console.error('[polar] token exchange failed:', tokenRes.status, await tokenRes.text().catch(() => ''))
    return NextResponse.json({ error: 'Kunne ikke koble til Polar' }, { status: 502 })
  }

  const tokenData = await tokenRes.json()
  const accessToken: string = tokenData.access_token
  const polarUserId: string = String(tokenData.x_user_id)

  // Register the user with AccessLink — required once before any data can
  // be read. A 409 means they're already registered from a prior connect;
  // treat that as success rather than an error.
  const registerRes = await fetch('https://www.polaraccesslink.com/v3/users', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ 'member-id': userId }),
  })

  if (!registerRes.ok && registerRes.status !== 409) {
    console.error('[polar] user registration failed:', registerRes.status, await registerRes.text().catch(() => ''))
    return NextResponse.json({ error: 'Kunne ikke registrere bruker hos Polar' }, { status: 502 })
  }

  const { error: upsertError } = await admin
    .from('polar_connections')
    .upsert({
      user_id:       userId,
      polar_user_id: polarUserId,
      member_id:     userId,
      access_token:  accessToken,
      token_type:    tokenData.token_type ?? 'bearer',
      connected_at:  new Date().toISOString(),
    })

  if (upsertError) {
    console.error('[polar] failed to store connection:', upsertError.message)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const admin  = createAdminClient()
  const userId = await getAuthedUserId(req, admin)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: conn } = await admin
    .from('polar_connections')
    .select('polar_user_id, access_token')
    .eq('user_id', userId)
    .maybeSingle()

  if (conn) {
    // Best-effort de-registration with Polar (revokes the token on their
    // side too) — don't fail the disconnect if this errors out.
    try {
      await fetch(`https://www.polaraccesslink.com/v3/users/${conn.polar_user_id}`, {
        method:  'DELETE',
        headers: { 'Authorization': `Bearer ${conn.access_token}` },
      })
    } catch (err) {
      console.warn('[polar] de-registration request failed (continuing anyway):', err)
    }
  }

  await admin.from('polar_connections').delete().eq('user_id', userId)
  return NextResponse.json({ ok: true })
}
