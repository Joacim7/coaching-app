import ResetPasswordForm from './reset-password-form'

// Client form needs NEXT_PUBLIC_SUPABASE_URL/ANON_KEY at runtime, not build
// time — force dynamic rendering so this page is never prerendered.
export const dynamic = 'force-dynamic'

export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}
