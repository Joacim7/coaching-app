'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { useLocale } from '@/components/locale-provider'

export function PlanDeleteButton({ planId, planTitle }: { planId: string; planTitle: string }) {
  const router = useRouter()
  const { t } = useLocale()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(t('clientDetail.training.deletePlanConfirm', { title: planTitle }))) return
    setDeleting(true)
    const res = await fetch(`/api/training-plans/${planId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? t('clientDetail.training.deletePlanFailed'))
      setDeleting(false)
      return
    }
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      title={t('clientDetail.training.deletePlanTooltip')}
      className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
