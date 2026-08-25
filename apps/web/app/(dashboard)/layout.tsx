import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { RecordingProvider } from '@/components/recording-provider'
import { coachHasActiveAccess } from '@/lib/paywall'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // /organization is exempt from this gate — it's exactly where a standalone
  // coach with no individual subscription needs to go to create and pay for
  // an org (which is itself how they'd become exempt otherwise). It enforces
  // its own access rules internally (name+plan before an org exists, plan
  // picker for a still-unpaid org, full dashboard once active).
  const pathname = (await headers()).get('x-pathname') ?? ''
  const isOrgRoute = pathname.startsWith('/organization')

  // Standalone coaches without an active subscription can't use the
  // dashboard at all — exempt coaches (org admin, org members) always pass.
  if (user && !isOrgRoute && !(await coachHasActiveAccess(supabase, user.id))) {
    console.warn(`[dashboard paywall] redirecting user.id="${user.id}" (len ${user.id.length}) to /pricing`)
    redirect('/pricing')
  }

  return (
    <RecordingProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <div className="flex-1 ml-64 flex flex-col overflow-hidden">
          <Header coachId={user!.id} />
          <main className="flex-1 overflow-y-auto">
            <div className="p-8">{children}</div>
          </main>
        </div>
      </div>
    </RecordingProvider>
  )
}
