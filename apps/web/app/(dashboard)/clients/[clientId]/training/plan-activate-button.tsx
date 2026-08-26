'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EyeOff, Check } from 'lucide-react'
import { useLocale } from '@/components/locale-provider'

export function PlanActivateButton({ planId, isActive }: { planId: string; isActive: boolean }) {
  const router = useRouter()
  const { t } = useLocale()
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    const res = await fetch(`/api/training-plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? t('clientDetail.training.updateFailed'))
      setLoading(false)
      return
    }
    router.refresh()
  }

  return isActive ? (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={t('clientDetail.training.makeInactive')}
      className="shrink-0 flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
    >
      <EyeOff className="w-3.5 h-3.5" />
      {t('clientDetail.training.makeInactive')}
    </button>
  ) : (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={t('clientDetail.training.activate')}
      className="shrink-0 flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-[#1a5c3a] hover:bg-[#ebf5ef] disabled:opacity-50 transition-colors"
    >
      <Check className="w-3.5 h-3.5" />
      {t('clientDetail.training.activate')}
    </button>
  )
}
