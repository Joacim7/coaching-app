import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // This runs on the Edge Runtime for nearly every request (see the matcher
  // in middleware.ts). If anything below throws — a network blip talking to
  // Supabase's Auth API, a transient timeout, missing env vars, etc. — and
  // it isn't caught, Vercel reports MIDDLEWARE_INVOCATION_FAILED and the
  // *entire site* 500s for every visitor, not just the one problem request.
  // Fail open instead: log it, let the request through unauthenticated
  // rather than take the whole app down. Pages/routes that actually need a
  // session still enforce that themselves server-side.
  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[middleware] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY not set — skipping auth check')
      return supabaseResponse
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
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
  } catch (err) {
    console.error('[middleware] updateSession threw — failing open (letting request through):', err)
    return NextResponse.next({ request })
  }
}
