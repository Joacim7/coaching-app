'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Building2, Users, UserPlus, FileText, BarChart2, Shield,
  Upload, Trash2, Loader2, Download, File, Plus, X, Mail,
  Clock, CheckCircle2, XCircle, Dumbbell, ChefHat, ClipboardList, Activity,
  Share2, Link,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Org {
  id: string
  name: string
  max_coaches: number
  created_at: string
  created_by: string
}

interface Stats {
  coachCount: number
  maxCoaches: number
  totalClients: number
  pendingInvitations: number
}

interface OrgMember {
  id: string
  role: string
  joined_at: string
  user_id: string
  profiles: { full_name: string | null; email: string | null } | null
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  token: string
  created_at: string
  expires_at: string
}

interface OrgDocument {
  id: string
  name: string
  description: string | null
  file_path: string
  file_size_bytes: number | null
  file_type: string | null
  created_at: string
  profiles: { full_name: string | null } | null
}

type Tab = 'info' | 'coaches' | 'resources' | 'clients' | 'contracts' | 'economics'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function fileIcon(type: string | null) {
  if (!type) return <File className="w-5 h-5 text-gray-400" />
  if (type.includes('pdf'))   return <FileText className="w-5 h-5 text-red-500" />
  if (type.includes('image')) return <File className="w-5 h-5 text-[#2d8653]" />
  if (type.includes('sheet') || type.includes('excel')) return <File className="w-5 h-5 text-green-500" />
  return <File className="w-5 h-5 text-gray-400" />
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, icon, color, value, sub, badge,
}: {
  label: string
  icon: React.ReactNode
  color: string
  value?: string | number
  sub?: string
  badge?: { text: string; color: string }
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        {badge ? (
          <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${badge.color}`}>
            {badge.text}
          </span>
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        )}
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Create org panel ──────────────────────────────────────────────────────────

function CreateOrgPanel({ onCreated }: { onCreated: (org: Org) => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setSaving(false)
    if (res.ok) {
      const org = await res.json()
      onCreated(org)
    } else {
      const j = await res.json()
      setError(j.error ?? 'Noe gikk galt')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="w-16 h-16 rounded-2xl bg-[#ebf5ef] flex items-center justify-center">
        <Building2 className="w-8 h-8 text-[#2d8653]" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">Opprett organisasjon</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">
          Du er ikke koblet til noen organisasjon ennå. Opprett én for å invitere andre coacher og dele ressurser.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Organisasjonsnavn"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          onClick={handleCreate}
          disabled={saving || !name.trim()}
          className="h-11 rounded-xl bg-[#2d8653] text-white text-sm font-semibold hover:bg-[#2d8653] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Opprett organisasjon
        </button>
      </div>
    </div>
  )
}

// ── Coaches tab ───────────────────────────────────────────────────────────────

function CoachesTab({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  const [members, setMembers]         = useState<OrgMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading]         = useState(true)
  const [showInvite, setShowInvite]   = useState(false)
  const [email, setEmail]             = useState('')
  const [inviting, setInviting]       = useState(false)
  const [toast, setToast]             = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/organization/coaches')
    if (res.ok) {
      const d = await res.json()
      setMembers(d.members ?? [])
      setInvitations(d.invitations ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  void orgId // used in page-level context

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleInvite() {
    if (!email.trim()) return
    setInviting(true)
    const res = await fetch('/api/organization/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    setInviting(false)
    if (res.ok) {
      const inv = await res.json()
      setInvitations(prev => [inv, ...prev])
      setEmail('')
      setShowInvite(false)
      showToast('Invitasjon sendt')
    }
  }

  async function handleCancelInvite(id: string) {
    await fetch('/api/organization/invitations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setInvitations(prev => prev.filter(i => i.id !== id))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 bg-green-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">
          Coacher <span className="ml-1.5 text-xs font-normal text-gray-400">{members.length} membre(r)</span>
        </h2>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(s => !s)}
            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[#2d8653] text-white text-sm font-semibold hover:bg-[#2d8653] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Inviter coach
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="bg-[#ebf5ef] border border-[#cdeee3] rounded-2xl p-4 flex items-center gap-3">
          <Mail className="w-4 h-4 text-[#6ecfb0] flex-shrink-0" />
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="E-postadresse til coach"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
            className="flex-1 h-9 px-3 rounded-lg border border-[#cdeee3] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
          />
          <button
            onClick={handleInvite}
            disabled={inviting || !email.trim()}
            className="h-9 px-4 rounded-lg bg-[#2d8653] text-white text-sm font-semibold hover:bg-[#2d8653] disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
          >
            {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Send
          </button>
          <button onClick={() => { setShowInvite(false); setEmail('') }} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Members list */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {members.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">Ingen coacher ennå</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {members.map(m => (
              <div key={m.id} className="px-5 py-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-[#cdeee3] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-[#1a5c3a]">
                    {getInitials(m.profiles?.full_name ?? null)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{m.profiles?.full_name ?? m.profiles?.email ?? 'Ukjent'}</p>
                  {m.profiles?.email && (
                    <p className="text-xs text-gray-400">{m.profiles.email}</p>
                  )}
                </div>
                <span className={`inline-flex items-center h-5 px-2 rounded-full text-xs font-semibold ${
                  m.role === 'admin' ? 'bg-[#ebf5ef] text-[#1a5c3a]' : 'bg-gray-100 text-gray-600'
                }`}>
                  {m.role === 'admin' ? 'Admin' : 'Coach'}
                </span>
                <p className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">{formatDate(m.joined_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-600">Ventende invitasjoner</h3>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {invitations.map(inv => (
              <div key={inv.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  inv.status === 'pending' ? 'bg-yellow-50' : inv.status === 'accepted' ? 'bg-green-50' : 'bg-gray-50'
                }`}>
                  {inv.status === 'pending' ? (
                    <Clock className="w-3.5 h-3.5 text-yellow-500" />
                  ) : inv.status === 'accepted' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{inv.email}</p>
                  <p className="text-xs text-gray-400">
                    Utløper {formatDate(inv.expires_at)}
                  </p>
                </div>
                <span className={`inline-flex items-center h-5 px-2 rounded-full text-xs font-semibold ${
                  inv.status === 'pending'  ? 'bg-yellow-50 text-yellow-700' :
                  inv.status === 'accepted' ? 'bg-green-50 text-green-700'  :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {inv.status === 'pending' ? 'Venter' : inv.status === 'accepted' ? 'Akseptert' : inv.status}
                </span>
                {inv.status === 'pending' && (
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/accept-invite/${inv.token}`
                      navigator.clipboard.writeText(url)
                      showToast('Lenke kopiert')
                    }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-[#2d8653] hover:bg-[#ebf5ef] transition-colors flex-shrink-0"
                    title="Kopier invitasjonslenke"
                  >
                    <Link className="w-3.5 h-3.5" />
                  </button>
                )}
                {isAdmin && inv.status === 'pending' && (
                  <button
                    onClick={() => handleCancelInvite(inv.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                    title="Avbryt invitasjon"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Delte ressurser tab ───────────────────────────────────────────────────────

type ResourceType = 'checkin_template' | 'training_plan' | 'exercise' | 'recipe'

interface SharedItem {
  shareId:    string
  resourceId: string
  name:       string
  meta:       string
  sharedAt:   string
}
interface PickerItem { id: string; name: string }

const TYPE_CONFIG: Record<ResourceType, { label: string; metaLabel: string; icon: React.ReactNode }> = {
  checkin_template: { label: 'Check-in maler', metaLabel: 'Spørsmål',  icon: <ClipboardList className="w-4 h-4" /> },
  training_plan:    { label: 'Treningsplaner', metaLabel: 'Økter',     icon: <Dumbbell      className="w-4 h-4" /> },
  exercise:         { label: 'Øvelser',        metaLabel: 'Muskler',   icon: <Activity      className="w-4 h-4" /> },
  recipe:           { label: 'Oppskrifter',    metaLabel: 'Porsjoner', icon: <ChefHat       className="w-4 h-4" /> },
}
const RESOURCE_TYPES = Object.keys(TYPE_CONFIG) as ResourceType[]

function SharedResourcesTab({ orgId, isAdmin, userId }: { orgId: string; isAdmin: boolean; userId: string }) {
  const supabase = createClient()

  const [activeType, setActiveType]     = useState<ResourceType>('checkin_template')
  const [shared, setShared]             = useState<Record<ResourceType, SharedItem[]>>({
    checkin_template: [], training_plan: [], exercise: [], recipe: [],
  })
  const [loading, setLoading]           = useState(true)
  const [pickerOpen, setPickerOpen]     = useState(false)
  const [pickerItems, setPickerItems]   = useState<PickerItem[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [removing, setRemoving]         = useState<string | null>(null)
  const [toast, setToast]               = useState('')

  // ── Documents ──
  const [docs, setDocs]               = useState<OrgDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleting, setDeleting]       = useState<string | null>(null)
  const docInputRef                   = useRef<HTMLInputElement>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── Load shared resources ──
  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: rows, error } = await supabase
        .from('org_shared_resources')
        .select('id, resource_type, resource_id, created_at')
        .eq('org_id', orgId)

      if (error || !rows?.length) { setLoading(false); return }

      const byType: Record<string, string[]> = {}
      for (const r of rows) { byType[r.resource_type] ??= []; byType[r.resource_type].push(r.resource_id) }

      // Meta maps: id → { name, meta }
      const infoMap: Record<string, { name: string; meta: string }> = {}

      await Promise.all([
        byType.recipe?.length && supabase
          .from('recipes').select('id,title,servings').in('id', byType.recipe)
          .then(({ data }) => data?.forEach(r => { infoMap[r.id] = { name: r.title, meta: r.servings ? `${r.servings} porsjoner` : '—' } })),

        byType.exercise?.length && supabase
          .from('exercises').select('id,name,muscle_groups').in('id', byType.exercise)
          .then(({ data }) => data?.forEach(r => {
            const groups: string[] = Array.isArray(r.muscle_groups) ? r.muscle_groups : []
            infoMap[r.id] = { name: r.name, meta: groups.length ? groups.slice(0, 2).join(', ') + (groups.length > 2 ? ` +${groups.length - 2}` : '') : '—' }
          })),

        byType.training_plan?.length && (async () => {
          const { data: plans }    = await supabase.from('training_plans').select('id,title').in('id', byType.training_plan)
          const { data: sessions } = await supabase.from('training_sessions').select('training_plan_id').in('training_plan_id', byType.training_plan)
          const counts: Record<string, number> = {}
          for (const s of sessions ?? []) counts[s.training_plan_id] = (counts[s.training_plan_id] ?? 0) + 1
          for (const p of plans ?? []) infoMap[p.id] = { name: p.title, meta: `${counts[p.id] ?? 0} økter` }
        })(),

        byType.checkin_template?.length && supabase
          .from('checkin_templates').select('id,name,questions').in('id', byType.checkin_template)
          .then(({ data }) => data?.forEach(r => {
            const q = Array.isArray(r.questions) ? r.questions.length : 0
            infoMap[r.id] = { name: r.name, meta: `${q} spørsmål` }
          })),
      ])

      const result: Record<ResourceType, SharedItem[]> = { checkin_template: [], training_plan: [], exercise: [], recipe: [] }
      for (const r of rows) {
        if (r.resource_type in result) {
          const info = infoMap[r.resource_id]
          result[r.resource_type as ResourceType].push({
            shareId:    r.id,
            resourceId: r.resource_id,
            name:       info?.name    ?? 'Ukjent',
            meta:       info?.meta    ?? '—',
            sharedAt:   r.created_at,
          })
        }
      }
      setShared(result)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  // ── Load documents ──
  useEffect(() => {
    fetch('/api/organization/documents').then(r => r.json()).then(d => {
      setDocs(Array.isArray(d) ? d : [])
      setDocsLoading(false)
    })
  }, [])

  // ── Picker: open for active type ──
  async function openPicker() {
    if (pickerOpen) { setPickerOpen(false); return }
    setPickerOpen(true)
    setPickerLoading(true)
    setPickerSearch('')

    const alreadyShared = new Set(shared[activeType].map(s => s.resourceId))
    let items: PickerItem[] = []

    if (activeType === 'recipe') {
      const { data } = await supabase.from('recipes').select('id,title')
      items = (data ?? []).filter(r => !alreadyShared.has(r.id)).map(r => ({ id: r.id, name: r.title }))
    } else if (activeType === 'exercise') {
      const { data } = await supabase.from('exercises').select('id,name').eq('is_standard', false)
      items = (data ?? []).filter(r => !alreadyShared.has(r.id)).map(r => ({ id: r.id, name: r.name }))
    } else if (activeType === 'training_plan') {
      const { data } = await supabase.from('training_plans').select('id,title').is('client_id', null)
      items = (data ?? []).filter(r => !alreadyShared.has(r.id)).map(r => ({ id: r.id, name: r.title }))
    } else {
      const { data } = await supabase.from('checkin_templates').select('id,name')
      items = (data ?? []).filter(r => !alreadyShared.has(r.id)).map(r => ({ id: r.id, name: r.name }))
    }

    setPickerItems(items)
    setPickerLoading(false)
  }

  // Close picker when switching tabs
  function switchTab(type: ResourceType) {
    setActiveType(type)
    setPickerOpen(false)
  }

  async function handleAdd(resourceId: string, name: string) {
    const { data, error } = await supabase
      .from('org_shared_resources')
      .insert({ org_id: orgId, resource_type: activeType, resource_id: resourceId, shared_by: userId })
      .select('id, created_at')
      .single()
    if (error) {
      showToast(`Feil: ${error.message}`)
      return
    }
    if (data) {
      setShared(prev => ({
        ...prev,
        [activeType]: [...prev[activeType], { shareId: data.id, resourceId, name, meta: '—', sharedAt: data.created_at }],
      }))
      setPickerItems(prev => prev.filter(i => i.id !== resourceId))
    }
  }

  async function handleRemove(shareId: string) {
    setRemoving(shareId)
    await supabase.from('org_shared_resources').delete().eq('id', shareId)
    setShared(prev => ({ ...prev, [activeType]: prev[activeType].filter(s => s.shareId !== shareId) }))
    setRemoving(null)
  }

  // ── Document handlers ──
  async function handleUpload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    setUploadError(null)

    let uploadedCount = 0

    for (const file of Array.from(files)) {
      const ext  = file.name.split('.').pop() ?? 'bin'
      const path = `${orgId}/${crypto.randomUUID()}.${ext}`

      const { error: storageErr } = await supabase.storage
        .from('org-documents')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (storageErr) {
        setUploadError(`Feil ved opplasting av «${file.name}»: ${storageErr.message}`)
        setUploading(false)
        return
      }

      const res = await fetch('/api/organization/documents', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:            file.name,
          file_path:       path,
          file_size_bytes: file.size,
          file_type:       file.type,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        // Clean up the orphaned storage file
        await supabase.storage.from('org-documents').remove([path])
        setUploadError(`Feil ved lagring av «${file.name}»: ${body.error ?? res.statusText}`)
        setUploading(false)
        return
      }

      const doc = await res.json()
      setDocs(prev => [doc, ...prev])
      uploadedCount++
    }

    setUploading(false)
    if (uploadedCount > 0) showToast(`${uploadedCount} dokument${uploadedCount > 1 ? 'er' : ''} lastet opp`)
  }

  async function handleDeleteDoc(doc: OrgDocument) {
    setDeleting(doc.id)
    const res = await fetch(`/api/organization/documents/${doc.id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setDocs(prev => prev.filter(d => d.id !== doc.id))
    } else {
      const body = await res.json().catch(() => ({}))
      showToast(`Feil ved sletting: ${body.error ?? res.statusText}`)
    }
    setDeleting(null)
  }

  function getDownloadUrl(path: string) {
    return supabase.storage.from('org-documents').getPublicUrl(path).data.publicUrl
  }

  const currentItems = shared[activeType]
  const { metaLabel } = TYPE_CONFIG[activeType]
  const filteredPicker = pickerItems.filter(i =>
    !pickerSearch || i.name.toLowerCase().includes(pickerSearch.toLowerCase())
  )

  // ── Render ──
  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 bg-green-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* ── Shared resources card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">

        {/* Card header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Delte ressurser</h2>
              <p className="text-sm text-gray-500 mt-0.5">Maler tilgjengelig for alle coacher i organisasjonen</p>
            </div>
            {isAdmin && (
              <button
                onClick={openPicker}
                className={`flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold transition-colors flex-shrink-0 ${
                  pickerOpen
                    ? 'bg-gray-100 text-gray-700'
                    : 'bg-[#2d8653] text-white hover:bg-[#1a5c3a]'
                }`}
              >
                {pickerOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {pickerOpen ? 'Avbryt' : 'Del eksisterende'}
              </button>
            )}
          </div>

          {/* Type tabs */}
          <div className="flex gap-0.5 mt-4 -mb-px">
            {RESOURCE_TYPES.map(type => {
              const cfg   = TYPE_CONFIG[type]
              const count = shared[type].length
              return (
                <button
                  key={type}
                  onClick={() => switchTab(type)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeType === type
                      ? 'border-[#2d8653] text-[#2d8653]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {cfg.icon}
                  {cfg.label}
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                      activeType === type ? 'bg-[#cdeee3] text-[#1a5c3a]' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Picker panel */}
        {pickerOpen && isAdmin && (
          <div className="px-6 py-4 bg-[#ebf5ef]/50 border-b border-[#cdeee3]">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1">
                <input
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  placeholder={`Søk etter ${TYPE_CONFIG[activeType].label.toLowerCase()}…`}
                  autoFocus
                  className="w-full h-9 pl-3 pr-3 rounded-lg border border-[#cdeee3] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6ecfb0]"
                />
              </div>
            </div>
            {pickerLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-[#6ecfb0] animate-spin" />
              </div>
            ) : filteredPicker.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                {pickerItems.length === 0
                  ? `Ingen ${TYPE_CONFIG[activeType].label.toLowerCase()} å dele`
                  : 'Ingen treff'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto">
                {filteredPicker.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleAdd(item.id, item.name)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white border border-[#cdeee3] hover:border-[#6ecfb0] hover:bg-[#ebf5ef] text-left transition-colors text-sm text-gray-800 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#2d8653] flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
          </div>
        ) : currentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-300 mb-3">
              {TYPE_CONFIG[activeType].icon}
            </div>
            <p className="text-sm font-medium text-gray-500">
              Ingen {TYPE_CONFIG[activeType].label.toLowerCase()} er delt ennå
            </p>
            {isAdmin && (
              <p className="text-xs text-gray-400 mt-1">
                Klikk «Del eksisterende» for å legge til
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Navn</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{metaLabel}</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Opprettet</th>
                  {isAdmin && <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Handlinger</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currentItems.map(item => (
                  <tr key={item.shareId} className="group hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#ebf5ef] flex items-center justify-center text-[#2d8653] flex-shrink-0">
                          {TYPE_CONFIG[activeType].icon}
                        </div>
                        <span className="font-medium text-gray-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-gray-500">{item.meta}</td>
                    <td className="px-6 py-3.5 text-gray-500">{formatDate(item.sharedAt)}</td>
                    {isAdmin && (
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => handleRemove(item.shareId)}
                          disabled={removing === item.shareId}
                          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                          title="Fjern deling"
                        >
                          {removing === item.shareId
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                          Fjern
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Organisasjonsdokumenter ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Organisasjonsdokumenter</h2>
            <p className="text-sm text-gray-500 mt-0.5">Filer delt med alle coacher i organisasjonen</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => docInputRef.current?.click()}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {uploading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Upload className="w-4 h-4" />}
              Last opp dokument
            </button>
          )}
        </div>

        {isAdmin && (
          <input
            ref={docInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.webp"
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
        )}

        {/* Upload error */}
        {uploadError && (
          <div className="mx-6 mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-700">Opplasting mislyktes</p>
              <p className="text-xs text-red-600 mt-0.5">{uploadError}</p>
            </div>
            <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {docsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
          </div>
        ) : docs.length === 0 ? (
          <div
            onClick={isAdmin ? () => docInputRef.current?.click() : undefined}
            onDragOver={isAdmin ? e => e.preventDefault() : undefined}
            onDrop={isAdmin ? e => { e.preventDefault(); handleUpload(e.dataTransfer.files) } : undefined}
            className={`px-6 py-12 flex flex-col items-center gap-2 text-center ${isAdmin ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
          >
            <Upload className="w-6 h-6 text-gray-300" />
            <p className="text-sm text-gray-400">
              {isAdmin ? 'Klikk eller dra filer hit for å laste opp' : 'Ingen dokumenter er lastet opp ennå'}
            </p>
          </div>
        ) : (
          <div
            onDragOver={isAdmin ? e => e.preventDefault() : undefined}
            onDrop={isAdmin ? e => { e.preventDefault(); handleUpload(e.dataTransfer.files) } : undefined}
          >
            {/* Doc table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-2 border-b border-gray-50">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Navn</span>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Størrelse</span>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Dato</span>
              <span />
            </div>
            {docs.map(doc => (
              <div key={doc.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-6 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                {/* Name + icon */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0">{fileIcon(doc.file_type)}</div>
                  <span className="text-sm font-medium text-gray-900 truncate">{doc.name}</span>
                </div>
                {/* Status badge */}
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 whitespace-nowrap">
                  <CheckCircle2 className="w-3 h-3" />
                  Publisert
                </span>
                {/* File size */}
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {formatBytes(doc.file_size_bytes) || '—'}
                </span>
                {/* Date */}
                <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(doc.created_at)}</span>
                {/* Actions */}
                <div className="flex items-center gap-1">
                  <a
                    href={getDownloadUrl(doc.file_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#2d8653] hover:bg-[#ebf5ef] transition-colors"
                    title="Last ned"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteDoc(doc)}
                      disabled={deleting === doc.id}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                      title="Slett"
                    >
                      {deleting === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stub tab ──────────────────────────────────────────────────────────────────

function StubTab({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-300">
        {icon}
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-gray-700">{label}</p>
        <p className="text-sm text-gray-400 mt-1">Kommer snart</p>
      </div>
    </div>
  )
}

// ── Org clients tab ───────────────────────────────────────────────────────────

interface OrgClient {
  id: string
  profileId: string
  name: string
  status: string
  coachId: string
  coachName: string
  joinedAt: string
}

const CLIENT_STATUS: Record<string, { label: string; pill: string; dot: string }> = {
  active:     { label: 'Aktiv',       pill: 'bg-[#ebf5ef] text-[#1a5c3a]', dot: 'bg-[#2d8653]' },
  inactive:   { label: 'Inaktiv',     pill: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-400'  },
  app_access: { label: 'App tilgang', pill: 'bg-blue-50 text-blue-700',     dot: 'bg-blue-500'  },
  new:        { label: 'Ny klient',   pill: 'bg-[#ebf5ef] text-[#1a5c3a]', dot: 'bg-[#2d8653]' },
  onboarding: { label: 'Onboarding',  pill: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-500'},
  course:     { label: 'På kurs',     pill: 'bg-[#ebf5ef] text-[#1a5c3a]', dot: 'bg-[#2d8653]' },
  followup:   { label: 'Oppfølging',  pill: 'bg-orange-50 text-orange-700', dot: 'bg-orange-400'},
}

function getClientInitials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

function OrgClientsTab() {
  const [clients, setClients]   = useState<OrgClient[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('alle')

  useEffect(() => {
    fetch('/api/organization/clients')
      .then(r => r.json())
      .then(d => { setClients(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  const activeCount    = clients.filter(c => c.status === 'active').length
  const appCount       = clients.filter(c => c.status === 'app_access').length
  const inactiveCount  = clients.filter(c => c.status === 'inactive').length

  const displayed = clients.filter(c => {
    const q = search.trim().toLowerCase()
    if (q && !c.name.toLowerCase().includes(q) && !c.coachName.toLowerCase().includes(q)) return false
    if (filterStatus !== 'alle' && c.status !== filterStatus) return false
    return true
  })

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#ebf5ef] text-[#1a5c3a]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2d8653]" />
          {activeCount} aktive
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          {appCount} app tilgang
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          {inactiveCount} inaktive
        </span>
      </div>

      {/* Search + status filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Søk etter klient eller coach..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-10 rounded-xl border border-gray-200 bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
          </svg>
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-10 pl-3 pr-8 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2d8653] appearance-none"
        >
          <option value="alle">Alle statuser</option>
          <option value="active">Aktiv</option>
          <option value="app_access">App tilgang</option>
          <option value="inactive">Inaktiv</option>
          <option value="new">Ny klient</option>
          <option value="onboarding">Onboarding</option>
          <option value="course">På kurs</option>
          <option value="followup">Oppfølging</option>
        </select>
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
          <p className="text-sm text-gray-400">Ingen klienter funnet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_160px_140px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50/60">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Klient</span>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</span>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Coach</span>
          </div>
          <div className="divide-y divide-gray-50">
            {displayed.map(client => {
              const sc = CLIENT_STATUS[client.status] ?? CLIENT_STATUS.inactive
              return (
                <div key={client.id} className="grid grid-cols-[1fr_160px_140px] gap-3 items-center px-5 py-3 hover:bg-gray-50/50 transition-colors">
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#cdeee3] flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-[#1a5c3a]">{getClientInitials(client.name)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{client.name}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(client.joinedAt).toLocaleDateString('nb-NO', { month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  {/* Status */}
                  <div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sc.pill}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                  </div>
                  {/* Coach */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-gray-500">{getClientInitials(client.coachName)}</span>
                    </div>
                    <span className="text-sm text-gray-600 truncate">{client.coachName}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

const ALL_TABS: { id: Tab; label: string; adminOnly?: boolean }[] = [
  { id: 'info',      label: 'Organisasjonsinfo' },
  { id: 'coaches',   label: 'Coacher' },
  { id: 'resources', label: 'Delte ressurser' },
  { id: 'clients',   label: 'Alle klienter', adminOnly: true },
  { id: 'contracts', label: 'Utløpende kontrakter' },
  { id: 'economics', label: 'Economics' },
]

export function OrganizationView({
  org: initialOrg,
  role,
  stats,
  userId,
}: {
  org: Org | null
  role: 'admin' | 'coach' | null
  stats: Stats | null
  userId: string
}) {
  const [org, setOrg]     = useState<Org | null>(initialOrg)
  const [tab, setTab]     = useState<Tab>('info')
  const isAdmin = role === 'admin'

  if (!org) {
    return (
      <div className="max-w-2xl mx-auto">
        <CreateOrgPanel onCreated={newOrg => setOrg(newOrg)} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[#ebf5ef] flex items-center justify-center flex-shrink-0">
          <Building2 className="w-6 h-6 text-[#2d8653]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Administrer organisasjon, coacher og delte ressurser</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 -mx-1">
        <nav className="flex gap-1 overflow-x-auto">
          {ALL_TABS.filter(t => !t.adminOnly || isAdmin).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-[#2d8653] text-[#2d8653]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {tab === 'info' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Din rolle"
                icon={<Shield className="w-5 h-5 text-[#2d8653]" />}
                color="bg-[#ebf5ef]"
                badge={
                  isAdmin
                    ? { text: 'Admin', color: 'bg-[#cdeee3] text-[#1a5c3a]' }
                    : { text: 'Coach', color: 'bg-gray-100 text-gray-700' }
                }
              />
              <StatCard
                label="Coacher"
                icon={<Users className="w-5 h-5 text-[#2d8653]" />}
                color="bg-[#ebf5ef]"
                value={stats.coachCount}
                sub={`av maks ${stats.maxCoaches}`}
              />
              <StatCard
                label="Totalt klienter"
                icon={<UserPlus className="w-5 h-5 text-green-600" />}
                color="bg-green-50"
                value={stats.totalClients}
              />
              <StatCard
                label="Ventende invitasjoner"
                icon={<Mail className="w-5 h-5 text-orange-600" />}
                color="bg-orange-50"
                value={stats.pendingInvitations}
                sub={stats.pendingInvitations > 0 ? 'venter på svar' : 'ingen ventende'}
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Detaljer</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Navn</dt>
                  <dd className="font-medium text-gray-900">{org.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Opprettet</dt>
                  <dd className="font-medium text-gray-900">{formatDate(org.created_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Maks coacher</dt>
                  <dd className="font-medium text-gray-900">{org.max_coaches}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {tab === 'coaches' && (
          <CoachesTab orgId={org.id} isAdmin={isAdmin} />
        )}

        {tab === 'resources' && (
          <SharedResourcesTab orgId={org.id} isAdmin={isAdmin} userId={userId} />
        )}

        {tab === 'clients' && isAdmin && (
          <OrgClientsTab />
        )}

        {tab === 'contracts' && (
          <StubTab icon={<FileText className="w-6 h-6" />} label="Utløpende kontrakter" />
        )}

        {tab === 'economics' && (
          <StubTab icon={<BarChart2 className="w-6 h-6" />} label="Economics" />
        )}
      </div>
    </div>
  )
}
