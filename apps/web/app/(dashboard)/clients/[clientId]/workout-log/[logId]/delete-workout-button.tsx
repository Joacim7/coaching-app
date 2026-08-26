'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { useLocale } from '@/components/locale-provider'

export function DeleteWorkoutButton({ clientId, logId }: { clientId: string; logId: string }) {
  const router = useRouter()
  const { t } = useLocale()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(t('clientDetail.workoutLog.deleteConfirm'))) return
    setDeleting(true)
    const res = await fetch(`/api/clients/${clientId}/workout-logs/${logId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push(`/clients/${clientId}/training`)
      router.refresh()
    } else {
      alert(t('clientDetail.workoutLog.deleteFailed'))
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
    >
      <Trash2 className="w-3.5 h-3.5" />
      {deleting ? t('clientDetail.workoutLog.deleting') : t('clientDetail.workoutLog.deleteSession')}
    </button>
  )
}
