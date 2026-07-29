import { createAdminClient } from './supabase/admin'

// The mobile app authenticates to these routes with its own Supabase
// access token (not a web session cookie), so we verify it directly
// against Supabase Auth rather than reading cookies.
export async function getAuthedUserId(
  req: Request,
  admin: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}
