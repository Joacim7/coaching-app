import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { getOrgSharedIds } from '@/lib/org-shared'
import { TemplateList } from './template-list'

export default async function CheckinTemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const sharedIds = await getOrgSharedIds(supabase, user!.id, 'checkin_template')
  const sharedSet = new Set(sharedIds)

  const base = supabase
    .from('checkin_templates')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: templates } = sharedIds.length > 0
    ? await base.or(`coach_id.eq.${user!.id},id.in.(${sharedIds.join(',')})`)
    : await base.eq('coach_id', user!.id)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1a5c3a]">Check-in maler</h1>
          <p className="text-gray-500 mt-1">Lag spørreskjema for klientene dine</p>
        </div>
        <Link href="/check-in-templates/new">
          <Button>
            <Plus className="w-4 h-4" />
            Ny mal
          </Button>
        </Link>
      </div>

      <TemplateList
        templates={templates ?? []}
        coachId={user!.id}
        sharedSet={sharedSet}
      />
    </div>
  )
}
