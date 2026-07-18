import { createClient } from '@/lib/supabase/server'
import SettingsView from './settings-view'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, phone, weight_unit, distance_unit, language')
    .eq('id', user!.id)
    .single()

  return (
    <SettingsView
      userId={user!.id}
      email={user!.email ?? ''}
      initialProfile={{
        full_name:     profile?.full_name     ?? '',
        avatar_url:    profile?.avatar_url    ?? null,
        phone:         profile?.phone         ?? '',
        weight_unit:   (profile?.weight_unit  ?? 'kg') as 'kg' | 'lb',
        distance_unit: (profile?.distance_unit ?? 'km') as 'km' | 'mi',
        language:      profile?.language      ?? 'nb',
      }}
    />
  )
}
