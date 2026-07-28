// Sends push notifications to the mobile app via Expo's push service.
// No API key needed — Expo's push endpoint is authenticated by the
// recipient's own Expo push token.

export async function sendExpoPushNotification({
  to,
  title,
  body,
}: {
  to: string
  title: string
  body: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!to.startsWith('ExponentPushToken')) {
    return { ok: false, error: 'Invalid Expo push token' }
  }

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({ to, title, body, sound: 'default' }),
    })

    const data = await res.json().catch(() => null)
    // Expo always returns data as an array of tickets, one per message sent —
    // even for a single, non-array request body.
    const ticket = Array.isArray(data?.data) ? data.data[0] : data?.data
    if (ticket?.status === 'error') {
      return { ok: false, error: ticket.message ?? 'Expo push service returned an error' }
    }
    if (!res.ok) {
      return { ok: false, error: `Expo push service responded ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[push] send failed:', msg)
    return { ok: false, error: msg }
  }
}
