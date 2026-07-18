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

  const { data: template } = await supabase
    .from('checkin_templates')
    .select('*')
    .eq('id', templateId)
    .eq('coach_id', user!.id)
    .single()

  if (!template) notFound()

  return <TemplateEditor initialTemplate={template} />
}
