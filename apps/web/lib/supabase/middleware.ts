import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute      = request.nextUrl.pathname.startsWith('/auth')
  const isInviteRoute    = request.nextUrl.pathname.startsWith('/accept-invite')
  // Public, unauthenticated client/lead flows — token/id in the URL is the
  // only authorization mechanism for these, so they must never bounce
  // through the coach login/register redirect below.
  const isOnboardingRoute = request.nextUrl.pathname.startsWith('/onboarding')
    || request.nextUrl.pathname.startsWith('/api/onboarding')
  const isStartRoute      = request.nextUrl.pathname.startsWith('/start')
    || request.nextUrl.pathname.startsWith('/api/intake')
  const isPublic = isAuthRoute || isInviteRoute || isOnboardingRoute || isStartRoute
    || request.nextUrl.pathname === '/'

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
