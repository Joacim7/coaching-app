import { ListChecks } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getTranslator, normalizeLocale } from '@/lib/i18n/translations'

export default async function HabitsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('language')
    .eq('id', user!.id)
    .single()
  const t = getTranslator(normalizeLocale(profile?.language))

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-teal-100 flex items-center justify-center mb-4">
        <ListChecks className="w-7 h-7 text-teal-600" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{t('clientDetail.habits.title')}</h3>
      <p className="text-sm text-gray-400 max-w-xs">
        {t('clientDetail.habits.comingSoon')}
      </p>
    </div>
  )
}
