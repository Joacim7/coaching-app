import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { IntakeForm } from './intake-form'

interface Question { id: string; text: string; type: string }

export default async function StartPage({
  params,
}: {
  params: Promise<{ coachId: string }>
}) {
  const { coachId } = await params
  const admin = createAdminClient()

  // Fetch coach profile (public — name only)
  const { data: coach } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('id', coachId)
    .single()

  if (!coach) notFound()

  // Fetch coach's oppstart template (if any)
  const { data: templates } = await admin
    .from('checkin_templates')
    .select('id, name, questions')
    .eq('coach_id', coachId)
    .eq('type', 'onboarding')
    .order('created_at', { ascending: false })
    .limit(1)

  const template = (templates?.[0] ?? null) as {
    id: string
    name: string
    questions: Question[]
  } | null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-[#ebf5ef]/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Coach header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#2d8653] flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
            {coach.full_name.slice(0, 1).toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{coach.full_name}</h1>
          {template && (
            <p className="text-gray-500 mt-1">{template.name}</p>
          )}
          {!template && (
            <p className="text-gray-500 mt-1">Oppstartsskjema</p>
          )}
        </div>

        <IntakeForm coachId={coachId} template={template} />
      </div>
    </div>
  )
}
