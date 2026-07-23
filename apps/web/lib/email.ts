import type { CheckinTemplate } from '@coaching/types'

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function sendWelcomeEmail({
  to,
  clientName,
  coachName,
  onboardingToken,
}: {
  to: string
  clientName: string
  coachName: string
  onboardingToken: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping welcome email to', to)
    return { ok: true }
  }

  const onboardingUrl = `${APP_URL}/onboarding/${onboardingToken}`
  const logoUrl = `${APP_URL}/nova-performance-logo.png`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">

        <!-- Logo -->
        <tr>
          <td style="background:#fff;padding:28px 40px 8px;text-align:center">
            <img src="${logoUrl}" alt="Nova Performance" width="160" style="display:block;margin:0 auto;height:auto" />
          </td>
        </tr>

        <!-- Header -->
        <tr>
          <td style="background:#1a5c3a;padding:28px 40px;text-align:center">
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#fff">Velkommen til Nova Performance!</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">
              Hei ${clientName}!<br><br>
              ${coachName} har lagt deg til som klient i Nova Performance. Vi gleder oss til å følge deg
              på reisen mot målene dine!
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6">
              Trykk på knappen under for å sette et passord og fylle ut oppstartsskjemaet ditt —
              det tar bare noen minutter og hjelper ${coachName} å gi deg best mulig oppfølging fra dag én.
            </p>

            <div style="text-align:center;margin-bottom:8px">
              <a href="${onboardingUrl}"
                 style="display:inline-block;padding:15px 36px;background:#2d8653;background:linear-gradient(to right,#1a5c3a,#6ecfb0);color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:16px">
                Kom i gang
              </a>
            </div>

            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center">
              Lenken er personlig og er bare til deg.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;background:#ebf5ef;border-top:1px solid #cdeee3;text-align:center">
            <p style="margin:0;font-size:12px;color:#2d8653;font-weight:600">Nova Performance</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)

    console.log('[email] sending welcome email — from:', FROM, 'to:', to)

    const { data, error } = await resend.emails.send({
      from:    FROM,
      to,
      subject: 'Velkommen til Nova Performance! 🎉',
      html,
    })

    console.log('[email] resend response — data:', JSON.stringify(data), 'error:', JSON.stringify(error))

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email] welcome email failed:', msg)
    return { ok: false, error: msg }
  }
}

export async function sendOrgInviteEmail({
  to,
  orgName,
  inviterName,
  inviteToken,
}: {
  to: string
  orgName: string
  inviterName: string
  inviteToken: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping org invite email to', to)
    return { ok: true }
  }

  const registerUrl = `${APP_URL}/auth/register?invite=${inviteToken}`
  const logoUrl = `${APP_URL}/nova-performance-logo.png`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">

        <!-- Logo -->
        <tr>
          <td style="background:#fff;padding:28px 40px 8px;text-align:center">
            <img src="${logoUrl}" alt="Nova Performance" width="160" style="display:block;margin:0 auto;height:auto" />
          </td>
        </tr>

        <!-- Header -->
        <tr>
          <td style="background:#1a5c3a;padding:28px 40px;text-align:center">
            <h1 style="margin:0;font-size:24px;font-weight:800;color:#fff">Du er invitert som coach til Nova Performance!</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">
              Hei!<br><br>
              ${inviterName} har invitert deg til å bli coach i <strong>${orgName}</strong> på Nova Performance.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6">
              Trykk på knappen under for å opprette kontoen din — du blir automatisk lagt til i
              organisasjonen så snart du er ferdig registrert.
            </p>

            <div style="text-align:center;margin-bottom:8px">
              <a href="${registerUrl}"
                 style="display:inline-block;padding:15px 36px;background:#2d8653;background:linear-gradient(to right,#1a5c3a,#6ecfb0);color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:16px">
                Kom i gang
              </a>
            </div>

            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center">
              Lenken er personlig og er bare til deg.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;background:#ebf5ef;border-top:1px solid #cdeee3;text-align:center">
            <p style="margin:0;font-size:12px;color:#2d8653;font-weight:600">Nova Performance</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)

    const { error } = await resend.emails.send({
      from:    FROM,
      to,
      subject: 'Du er invitert som coach til Nova Performance! 🎉',
      html,
    })

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email] org invite email failed:', msg)
    return { ok: false, error: msg }
  }
}

export async function sendOnboardingForm({
  to,
  clientName,
  coachName,
  template,
  onboardingToken,
}: {
  to: string
  clientName: string
  coachName: string
  template: CheckinTemplate
  onboardingToken: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping onboarding email to', to)
    return { ok: true }
  }

  const formUrl = `${APP_URL}/onboarding/${onboardingToken}`

  const questionsHtml = template.questions
    .map((q, i) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0">
          <p style="margin:0;font-size:14px;color:#111;font-weight:600">${i + 1}. ${q.text}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280">
            ${q.type === 'scale' ? 'Skala 1–10' : q.type === 'yesno' ? 'Ja / Nei' : 'Fritekst'}
          </p>
        </td>
      </tr>`)
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">

        <!-- Header -->
        <tr>
          <td style="background:#2563eb;padding:32px 40px;text-align:center">
            <p style="margin:0;font-size:13px;color:#bfdbfe;text-transform:uppercase;letter-spacing:.05em">Personlig trener</p>
            <h1 style="margin:8px 0 0;font-size:24px;font-weight:700;color:#fff">Velkommen, ${clientName}!</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px">
            <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">
              Hei ${clientName}!<br><br>
              ${coachName} har lagt deg til som klient og ønsker deg velkommen.
              Ta deg noen minutter til å fylle ut dette skjemaet — det hjelper treneren din å gi deg
              best mulig oppfølging fra første dag.
            </p>

            <h2 style="margin:24px 0 4px;font-size:16px;font-weight:600;color:#111">${template.name}</h2>
            <p style="margin:0 0 16px;font-size:13px;color:#6b7280">${template.questions.length} spørsmål</p>

            <table width="100%" cellpadding="0" cellspacing="0">
              ${questionsHtml}
            </table>

            <div style="margin:32px 0;text-align:center">
              <a href="${formUrl}"
                 style="display:inline-block;padding:14px 32px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px">
                Fyll ut skjema
              </a>
            </div>

            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
              Lenken er personlig og er bare til deg.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #f0f0f0;text-align:center">
            <p style="margin:0;font-size:12px;color:#9ca3af">Sendt via Nova Performance</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)

    const { error } = await resend.emails.send({
      from:    FROM,
      to,
      subject: `${coachName} ønsker deg velkommen — fyll ut oppstartsskjema`,
      html,
    })

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email] send failed:', msg)
    return { ok: false, error: msg }
  }
}

export async function sendCheckinReminder({
  to,
  clientName,
  coachName,
  templateName,
  scheduledTime,
}: {
  to: string
  clientName: string
  coachName: string
  templateName: string
  scheduledTime: string   // "HH:MM"
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping reminder to', to)
    return { ok: true }
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <tr>
          <td style="background:#2563eb;padding:28px 36px">
            <p style="margin:0;font-size:13px;color:#bfdbfe;text-transform:uppercase;letter-spacing:.05em">Ukentlig innsjekk</p>
            <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#fff">${templateName}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 36px">
            <p style="margin:0;font-size:15px;color:#374151;line-height:1.6">
              Hei ${clientName}!<br><br>
              ${coachName} har satt opp en ukentlig innsjekk for deg klokken <strong>${scheduledTime}</strong>.
              Logg inn i appen for å svare.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 36px 28px;background:#f9fafb;border-top:1px solid #f0f0f0;text-align:center">
            <p style="margin:0;font-size:12px;color:#9ca3af">Sendt via Nova Performance</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from:    FROM,
      to,
      subject: `Ukentlig innsjekk: ${templateName}`,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email] checkin reminder failed:', msg)
    return { ok: false, error: msg }
  }
}
