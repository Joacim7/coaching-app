import { NextResponse } from 'next/server'
import { sendAccountDeletionRequest } from '@/lib/email'

const EMAIL_RE = /^\S+@\S+\.\S+$/

// Public endpoint — no auth required. The person requesting deletion may not
// be able to log in at all, and Google Play's account-deletion requirement
// is that this page (and the request it submits) work without a session.
export async function POST(req: Request) {
  let email: string | undefined
  try {
    ;({ email } = await req.json() as { email?: string })
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 })
  }

  email = email?.trim()
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Ugyldig e-postadresse' }, { status: 400 })
  }

  const result = await sendAccountDeletionRequest({ email })

  if (!result.ok) {
    console.error('[account-deletion] failed to send request email:', result.error)
    return NextResponse.json({ error: 'Kunne ikke sende forespørselen. Prøv igjen.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
