import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import TemplateEditor from '../template-editor'

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>
}) {
  const { templateId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Not scoped to coach_id: RLS already allows reading a template shared
  // org-wide (see "read_org_shared_checkin_templates" in
  // 015_org_shared_resources.sql), so a coach opening an org-mate's shared
  // template should land in the editor read-only, rather than 404 — this
  // used to filter by coach_id here and 404 for anything the current coach
  // didn't personally own.
  const { data: template } = await supabase
    .from('checkin_templates')
    .select('*')
    .eq('id', templateId)
    .single()

  if (!template) notFound()

  const readOnly = template.coach_id !== user!.id

  return <TemplateEditor initialTemplate={template} readOnly={readOnly} />
}
