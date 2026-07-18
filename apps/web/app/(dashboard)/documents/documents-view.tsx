'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Upload, FileText, File, Trash2, Loader2, Download,
  Plus, X, Users, Eye, Share2, MoreVertical, Building2,
  CheckCircle2, XCircle, ChevronDown, Search, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MyDoc {
  id: string
  name: string
  description: string | null
  file_path: string
  file_size_bytes: number | null
  file_type: string | null
  created_at: string
  share_count: number
  shared_client_ids: string[]
}

export interface OrgDoc {
  id: string
  name: string
  file_path: string
  file_size_bytes: number | null
  file_type: string | null
  created_at: string
  shared_client_ids: string[]
}

interface Client { id: string; full_name: string }

interface ShareTarget {
  type: 'personal' | 'org'
  docId: string
  docName: string
  initialClientIds: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(b: number | null) {
  if (!b) return '—'
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fileIcon(type: string | null, size = 'md') {
  const cls = size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'
  if (!type) return <File className={`${cls} text-gray-400`} />
  if (type.includes('pdf'))            return <FileText className={`${cls} text-red-500`} />
  if (type.includes('image'))          return <File className={`${cls} text-[#2d8653]`} />
  if (type.includes('sheet') || type.includes('excel')) return <File className={`${cls} text-green-600`} />
  if (type.includes('word') || type.includes('document')) return <FileText className={`${cls} text-[#2d8653]`} />
  return <File className={`${cls} text-gray-400`} />
}

function publicUrl(supabase: ReturnType<typeof createClient>, bucket: string, path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

// ── Share modal ───────────────────────────────────────────────────────────────

function ShareModal({
  target,
  clients,
  onClose,
  onSaved,
}: {
  target: ShareTarget
  clients: Client[]
  onClose: () => void
  onSaved: (docId: string, type: ShareTarget['type'], clientIds: string[]) => void
}) {
  const [selected, setSelected]   = useState<Set<string>>(new Set(target.initialClientIds))
  const [search, setSearch]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const filtered = clients.filter(c =>
    !search || c.full_name.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const clientIds = [...selected]

    const url = target.type === 'personal'
      ? `/api/documents/${target.docId}/share`
      : `/api/documents/org-shares/${target.docId}/share`

    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clientIds }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Noe gikk galt')
      setSaving(false)
      return
    }

    onSaved(target.docId, target.type, clientIds)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Del med klienter</h2>
            <p className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">{target.docName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ml-4 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search + select all */}
        <div className="px-4 pt-4 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Søk etter klient…"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6ecfb0]"
            />
          </div>
          {clients.length > 0 && (
            <button
              onClick={() => {
                const allFiltered = filtered.map(c => c.id)
                const allSelected = allFiltered.every(id => selected.has(id))
                setSelected(allSelected
                  ? new Set([...selected].filter(id => !allFiltered.includes(id)))
                  : new Set([...selected, ...allFiltered])
                )
              }}
              className="text-xs font-semibold text-[#2d8653] hover:underline"
            >
              {filtered.every(c => selected.has(c.id)) && filtered.length > 0
                ? 'Fjern alle'
                : 'Velg alle'}
            </button>
          )}
        </div>

        {/* Client list */}
        <div className="px-4 py-3 max-h-72 overflow-y-auto space-y-1">
          {clients.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-6">Ingen klienter ennå</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">Ingen treff</p>
          ) : (
            filtered.map(client => {
              const on = selected.has(client.id)
              return (
                <button
                  key={client.id}
                  onClick={() => toggle(client.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                    on ? 'bg-[#ebf5ef]' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                    on ? 'bg-[#2d8653] border-[#2d8653]' : 'border-gray-300'
                  }`}>
                    {on && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6ecfb0] to-[#2d8653] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {client.full_name.charAt(0).toUpperCase()}
                  </div>
                  <span className={`text-sm flex-1 min-w-0 truncate ${on ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                    {client.full_name}
                  </span>
                </button>
              )
            })
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-700">{error}</span>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {selected.size > 0 ? `${selected.size} klient${selected.size > 1 ? 'er' : ''} valgt` : 'Ingen valgt'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Avbryt
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-4 rounded-xl text-sm font-semibold bg-[#2d8653] text-white hover:bg-[#1a5c3a] disabled:opacity-60 transition-colors flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Lagre
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Three-dot menu ────────────────────────────────────────────────────────────

function DocMenu({
  doc,
  bucketUrl,
  onShare,
  onDelete,
}: {
  doc: MyDoc
  bucketUrl: string
  onShare: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 overflow-hidden">
          <a
            href={bucketUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-4 h-4 text-gray-400" />
            Forhåndsvis
          </a>
          <a
            href={bucketUrl}
            download={doc.name}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4 text-gray-400" />
            Last ned
          </a>
          <button
            onClick={() => { setOpen(false); onShare() }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Share2 className="w-4 h-4 text-gray-400" />
            Del med klienter
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={() => { setOpen(false); onDelete() }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Slett
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function DocumentsView({
  coachId,
  myDocuments: initial,
  orgDocuments: initialOrg,
  orgName,
  clients,
}: {
  coachId: string
  myDocuments: MyDoc[]
  orgDocuments: OrgDoc[]
  orgName: string | null
  clients: Client[]
}) {
  const supabase = createClient()

  const [myDocs, setMyDocs]   = useState<MyDoc[]>(initial)
  const [orgDocs, setOrgDocs] = useState<OrgDoc[]>(initialOrg)

  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleting, setDeleting]       = useState<string | null>(null)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)
  const [toast, setToast]             = useState('')

  const inputRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── Upload ──────────────────────────────────────────────────────────────────
  async function handleUpload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    setUploadError(null)

    for (const file of Array.from(files)) {
      const ext  = file.name.split('.').pop() ?? 'bin'
      const path = `${coachId}/${crypto.randomUUID()}.${ext}`

      const { error: storageErr } = await supabase.storage
        .from('coach-documents')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (storageErr) {
        setUploadError(`Feil ved opplasting av «${file.name}»: ${storageErr.message}`)
        setUploading(false)
        return
      }

      const res = await fetch('/api/documents', {
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
        await supabase.storage.from('coach-documents').remove([path])
        setUploadError(`Feil ved lagring: ${body.error ?? res.statusText}`)
        setUploading(false)
        return
      }

      const doc: MyDoc = await res.json()
      // The DB trigger auto-shares with all current clients; reflect that immediately
      const allClientIds = clients.map(c => c.id)
      setMyDocs(prev => [{
        ...doc,
        share_count:       allClientIds.length,
        shared_client_ids: allClientIds,
      }, ...prev])
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    const n = clients.length
    showToast(n > 0
      ? `Dokument lastet opp og delt med ${n} klient${n > 1 ? 'er' : ''}`
      : 'Dokument lastet opp'
    )
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(doc: MyDoc) {
    if (!confirm(`Slett «${doc.name}»? Dette kan ikke angres.`)) return
    setDeleting(doc.id)

    const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setMyDocs(prev => prev.filter(d => d.id !== doc.id))
      showToast('Dokument slettet')
    } else {
      const body = await res.json().catch(() => ({}))
      showToast(`Feil: ${body.error ?? res.statusText}`)
    }
    setDeleting(null)
  }

  // ── Share saved ─────────────────────────────────────────────────────────────
  function handleShareSaved(docId: string, type: ShareTarget['type'], clientIds: string[]) {
    if (type === 'personal') {
      setMyDocs(prev => prev.map(d =>
        d.id === docId
          ? { ...d, share_count: clientIds.length, shared_client_ids: clientIds }
          : d
      ))
    } else {
      setOrgDocs(prev => prev.map(d =>
        d.id === docId ? { ...d, shared_client_ids: clientIds } : d
      ))
    }
    showToast(clientIds.length > 0
      ? `Delt med ${clientIds.length} klient${clientIds.length > 1 ? 'er' : ''}`
      : 'Deling fjernet'
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 max-w-4xl">

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Share modal */}
      {shareTarget && (
        <ShareModal
          target={shareTarget}
          clients={clients}
          onClose={() => setShareTarget(null)}
          onSaved={handleShareSaved}
        />
      )}

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a5c3a]">Dokumenter</h1>
          <p className="text-sm text-gray-500 mt-0.5">Last opp og del dokumenter med dine klienter</p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-5 rounded-xl"
          >
            {uploading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Plus className="w-4 h-4" />}
            Last opp dokument
          </Button>
        </div>
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
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

      {/* ── Fra organisasjonen ── */}
      {orgDocs.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Fra organisasjonen{orgName ? ` — ${orgName}` : ''}
            </h2>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {orgDocs.map(doc => {
              const url = publicUrl(supabase, 'org-documents', doc.file_path)
              return (
                <div key={doc.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                    {fileIcon(doc.file_type, 'lg')}
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 truncate">{doc.name}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ebf5ef] text-[#1a5c3a] whitespace-nowrap">
                        <Building2 className="w-2.5 h-2.5" />
                        Organisasjon
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatBytes(doc.file_size_bytes)} · {formatDate(doc.created_at)}
                      {doc.shared_client_ids.length > 0 && (
                        <> · <span className="text-[#2d8653] font-medium">{doc.shared_client_ids.length} klient{doc.shared_client_ids.length > 1 ? 'er' : ''}</span></>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Forhåndsvis
                    </a>
                    <button
                      onClick={() => setShareTarget({
                        type: 'org',
                        docId: doc.id,
                        docName: doc.name,
                        initialClientIds: doc.shared_client_ids,
                      })}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-[#2d8653] bg-[#ebf5ef] hover:bg-[#cdeee3] transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Del med klienter
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Mine dokumenter ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Mine dokumenter</h2>
          {myDocs.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">{myDocs.length}</span>
          )}
        </div>

        {myDocs.length === 0 ? (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}
            className="bg-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#6ecfb0] hover:bg-[#ebf5ef]/30 cursor-pointer transition-colors flex flex-col items-center justify-center py-16 gap-3"
          >
            {uploading
              ? <Loader2 className="w-8 h-8 text-[#6ecfb0] animate-spin" />
              : <Upload className="w-8 h-8 text-gray-300" />}
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">Klikk eller dra filer hit</p>
              <p className="text-xs text-gray-400 mt-0.5">PDF, Word, Excel, bilder — maks 100 MB</p>
            </div>
          </div>
        ) : (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50"
          >
            {myDocs.map(doc => {
              const url = publicUrl(supabase, 'coach-documents', doc.file_path)
              const isDeleting = deleting === doc.id

              return (
                <div
                  key={doc.id}
                  className={`px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                    {isDeleting
                      ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      : fileIcon(doc.file_type, 'lg')}
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 truncate">{doc.name}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 whitespace-nowrap">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Publisert
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {doc.share_count > 0
                        ? <><span className="text-[#2d8653] font-medium">{doc.share_count} klient{doc.share_count > 1 ? 'er' : ''}</span> · </>
                        : 'Ikke delt · '}
                      {formatBytes(doc.file_size_bytes)} · {formatDate(doc.created_at)}
                    </p>
                  </div>

                  {/* Three-dot menu */}
                  <DocMenu
                    doc={doc}
                    bucketUrl={url}
                    onShare={() => setShareTarget({
                      type: 'personal',
                      docId: doc.id,
                      docName: doc.name,
                      initialClientIds: doc.shared_client_ids,
                    })}
                    onDelete={() => handleDelete(doc)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
