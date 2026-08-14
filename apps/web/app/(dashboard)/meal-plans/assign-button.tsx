'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { UserPlus, X, Search } from 'lucide-react'

interface Props {
  planId: string
  clients: { id: string; name: string }[]
}

export function AssignMealPlanButton({ planId, clients }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const selectedClient = clients.find(c => c.id === selectedClientId)

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(c => c.name.toLowerCase().includes(q))
  }, [clients, query])

  async function handleAssign() {
    if (!selectedClientId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/meal-plans/${planId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId }),
      })
      const data = await res.json()
      if (data.newPlanId) router.push(`/meal-plans/${data.newPlanId}`)
    } finally {
      setLoading(false)
      close()
    }
  }

  function close() {
    setOpen(false)
    setQuery('')
    setSelectedClientId('')
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
    <div className="flex items-start gap-2">
      <div className="relative">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            autoFocus
            value={selectedClient ? selectedClient.name : query}
            onChange={e => { setQuery(e.target.value); setSelectedClientId('') }}
            onFocus={() => setSelectedClientId('')}
            placeholder="Søk klient..."
            className="h-8 w-48 text-sm border border-gray-300 rounded-md pl-7 pr-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
          />
        </div>
        {!selectedClientId && (
          <div className="absolute z-20 mt-1 w-48 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg">
            {filteredClients.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">Ingen treff</p>
            ) : (
              filteredClients.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setSelectedClientId(c.id); setQuery(c.name) }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-[#ebf5ef] transition-colors"
                >
                  {c.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <Button size="sm" onClick={handleAssign} disabled={!selectedClientId || loading}>
        {loading ? 'Tildeler...' : 'Tildel'}
      </Button>
      <button onClick={close} className="text-gray-400 hover:text-gray-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
