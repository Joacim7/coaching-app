import LoginForm from './login-form'

// Route segment config is only reliably honored by Next.js when exported
// from an actual Server Component page (not a 'use client' page file) —
// this is why that export previously had no effect here. This page has no
// server-side data needs itself; it exists only to force dynamic rendering
// so Next.js never prerenders the client form (which needs
// NEXT_PUBLIC_SUPABASE_URL/ANON_KEY) at build time.
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return <LoginForm />
}
