import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  console.log('[onboarding/set-password] POST received for token:', token)

  let password: string | undefined
  let firstName: string | undefined
  let lastName: string | undefined
  try {
    ;({ password, firstName, lastName } = await req.json() as {
      password?: string; firstName?: string; lastName?: string
    })
  } catch (err) {
    console.error('[onboarding/set-password] failed to parse request body:', err)
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 })
  }

  if (!password || password.length < 8) {
    console.warn('[onboarding/set-password] rejecting — password missing or too short')
    return NextResponse.json({ error: 'Passordet må være minst 8 tegn' }, { status: 400 })
  }

  firstName = firstName?.trim()
  lastName  = lastName?.trim()
  if (!firstName || !lastName) {
    console.warn('[onboarding/set-password] rejecting — first/last name missing')
    return NextResponse.json({ error: 'Fornavn og etternavn er påkrevd' }, { status: 400 })
  }
  const fullName = `${firstName} ${lastName}`

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (err) {
    console.error('[onboarding/set-password] createAdminClient failed (likely missing SUPABASE_SERVICE_ROLE_KEY):', err)
    return NextResponse.json({ error: 'Serverfeil — kontakt support' }, { status: 500 })
  }

  const { data: profile, error: fetchErr } = await admin
    .from('profiles')
    .select('id, email, full_name, has_account')
    .eq('onboarding_token', token)
    .single()

  console.log('[onboarding/set-password] token:', token, '— profile found:', !!profile, 'error:', fetchErr?.message ?? null)

  if (fetchErr || !profile) {
    console.warn('[onboarding/set-password] rejecting — invalid token or profile lookup failed')
    return NextResponse.json({ error: 'Ugyldig lenke' }, { status: 403 })
  }

  console.log('[onboarding/set-password] profile:', JSON.stringify({ id: profile.id, email: profile.email, has_account: profile.has_account }))

  if (!profile.email) {
    return NextResponse.json({ error: 'Ingen e-postadresse er registrert for denne klienten' }, { status: 400 })
  }

  // Idempotent — if the account already exists, just let the client move on
  // to the next step instead of erroring out on a second visit/retry. Still
  // save the real name here too, in case this is a retried request whose
  // first attempt already flipped has_account before the client saw the
  // response.
  if (profile.has_account) {
    await admin.from('profiles').update({ full_name: fullName }).eq('id', profile.id)
    return NextResponse.json({ ok: true, alreadyExists: true })
  }

  const { error: createErr } = await admin.auth.admin.createUser({
    id:            profile.id,
    email:         profile.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'client' },
  })

  console.log('[onboarding/set-password] createUser result — error:', createErr?.message ?? null)

  if (createErr) {
    // Account already exists on the auth side but our flag wasn't set yet —
    // treat as success rather than blocking the client.
    if (createErr.message.toLowerCase().includes('already been registered') ||
        createErr.message.toLowerCase().includes('already exists')) {
      await admin.from('profiles').update({ has_account: true, full_name: fullName }).eq('id', profile.id)
      return NextResponse.json({ ok: true, alreadyExists: true })
    }
    console.error('[onboarding/set-password] createUser failed:', createErr.message)
    return NextResponse.json({ error: createErr.message }, { status: 500 })
  }

  // Replaces whatever placeholder name the coach typed at invite time (often
  // just the client's email, entered as a shortcut) with the client's own
  // real name — this is what makes the coach dashboard show a real name
  // instead of an email address from this point on.
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ has_account: true, full_name: fullName })
    .eq('id', profile.id)

  if (updateErr) {
    console.error('[onboarding/set-password] profile update failed:', updateErr.message)
    // Account was created successfully — don't fail the request over this.
  }

  return NextResponse.json({ ok: true })
}
