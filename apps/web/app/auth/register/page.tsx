import RegisterForm from './register-form'

// See app/auth/login/page.tsx for why this is split into a Server Component
// page + separate Client Component form.
export const dynamic = 'force-dynamic'

export default function RegisterPage() {
  return <RegisterForm />
}
