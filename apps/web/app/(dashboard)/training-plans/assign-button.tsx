'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { UserPlus, X } from 'lucide-react'

interface Props {
  planId: string
  clients: { id: string; name: string }[]
}

export function AssignTrainingPlanButton({ planId, clients }: Props) {
  const [open, setOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleAssign() {
    if (!selectedClientId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/training-plans/${planId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId }),
      })
      const data = await res.json()
      if (data.newPlanId) {
        router.push(`/training-plans/${data.newPlanId}`)
      }
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="w-3.5 h-3.5" />
        Tildel
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedClientId}
        onChange={e => setSelectedClientId(e.target.value)}
        className="h-8 text-sm border border-gray-300 rounded-md px-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
      >
        <option value="">Velg klient...</option>
        {clients.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <Button size="sm" onClick={handleAssign} disabled={!selectedClientId || loading}>
        {loading ? 'Tildeler...' : 'Tildel'}
      </Button>
      <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
