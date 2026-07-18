'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, Settings, Loader2, Mail, Phone, Shield, Users, ExternalLink, AlertTriangle, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface Coach {
  id: string
  full_name: string | null
  email: string | null
}

interface ClientProfile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  app_access: boolean
}

interface Props {
  clientId: string
  clientName: string
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#2d8653] focus:ring-offset-2 disabled:opacity-50 ${
        checked ? 'bg-[#2d8653]' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function ClientSettingsPanel({ clientId, clientName }: Props) {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)

  // Form state
  const [email,      setEmail]      = useState('')
  const [phone,      setPhone]      = useState('')
  const [appAccess,  setAppAccess]  = useState(true)
  const [coaches,    setCoaches]    = useState<Coach[]>([])
  const [coachId,    setCoachId]    = useState('')
  const [origCoachId, setOrigCoachId] = useState('')

  // Delete client state
  const [deleteOpen,    setDeleteOpen]    = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting,      setDeleting]      = useState(false)
  const [deleteError,   setDeleteError]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/clients/${clientId}/settings`)
    if (res.ok) {
      const d = await res.json() as {
        profile: ClientProfile
        currentCoachId: string
        coaches: Coach[]
      }
      setEmail(d.profile?.email      ?? '')
      setPhone(d.profile?.phone      ?? '')
      setAppAccess(d.profile?.app_access ?? true)
      setCoaches(d.coaches ?? [])
      setCoachId(d.currentCoachId    ?? '')
      setOrigCoachId(d.currentCoachId ?? '')
    }
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/settings`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        phone,
        app_access:           appAccess,
        responsible_coach_id: coachId !== origCoachId ? coachId : undefined,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setOrigCoachId(coachId)
      showToast('Innstillinger lagret')
    } else {
      const j = await res.json()
      showToast(j.error ?? 'Noe gikk galt', false)
    }
  }

  function handleClose() {
    setOpen(false)
    setToast(null)
    setDeleteOpen(false)
    setDeleteConfirm('')
    setDeleteError('')
  }

  async function handleDelete() {
    if (deleteConfirm.trim() !== clientName.trim()) return
    setDeleting(true)
    setDeleteError('')

    const res = await fetch(`/api/clients/${clientId}/settings`, { method: 'DELETE' })

    if (res.ok) {
      router.push('/clients')
    } else {
      setDeleting(false)
      const j = await res.json().catch(() => ({}))
      setDeleteError(j.error ?? 'Kunne ikke slette klienten')
    }
  }

  return (
    <>
      {/* Gear button */}
      <button
        onClick={() => setOpen(true)}
        className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors"
        title="Klientinnstillinger"
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={handleClose}
        />
      )}

      {/* Slide-over panel */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Klientinnstillinger</h2>
            <p className="text-xs text-gray-400 mt-0.5">{clientName}</p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">

            {/* ── 1. Kontaktinformasjon ─────────────────────── */}
            <section className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Kontaktinformasjon</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">E-post</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="klient@epost.no"
                    className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653] focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Telefonnummer</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+47 000 00 000"
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653] focus:bg-white transition-colors"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ── 2. Apptilgang ────────────────────────────── */}
            <section className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Apptilgang</h3>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-800">Klienten kan logge inn i appen</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {appAccess
                      ? 'Klienten har tilgang til klientportalen'
                      : 'Tilgangen er deaktivert for denne klienten'}
                  </p>
                </div>
                <Toggle checked={appAccess} onChange={setAppAccess} />
              </div>
            </section>

            {/* ── 3. Ansvarlig coach ──────────────────────── */}
            <section className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Ansvarlig coach</h3>
              </div>
              {coaches.length <= 1 ? (
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-sm text-gray-600">
                    {coaches[0]?.full_name ?? 'Deg'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Legg til organisasjon for å gi klienter til andre coacher
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Velg coach</label>
                  <select
                    value={coachId}
                    onChange={e => setCoachId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653] focus:bg-white transition-colors"
                  >
                    {coaches.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.full_name ?? c.email ?? c.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            {/* ── 4. Rediger klientinfo ───────────────────── */}
            <section className="px-6 py-5 border-b border-gray-100">
              <Link
                href={`/clients/${clientId}/edit`}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-[#cdeee3] hover:bg-[#ebf5ef] hover:text-[#1a5c3a] transition-colors group"
              >
                <span>Rediger klientinfo</span>
                <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-[#6ecfb0] transition-colors" />
              </Link>
            </section>

            {/* ── 5. Farlig sone ──────────────────────────── */}
            <section className="px-6 py-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-semibold text-red-600">Farlig sone</h3>
              </div>

              {!deleteOpen ? (
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Slett klient
                </button>
              ) : (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                  <p className="text-sm text-red-700">
                    Dette sletter <strong>{clientName}</strong> permanent, inkludert treningsplaner,
                    matplaner, check-ins, logger og kontrakter. Dette kan ikke angres.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-red-700 mb-1">
                      Skriv inn «{clientName}» for å bekrefte
                    </label>
                    <input
                      type="text"
                      value={deleteConfirm}
                      onChange={e => setDeleteConfirm(e.target.value)}
                      placeholder={clientName}
                      className="w-full h-9 px-3 rounded-lg border border-red-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                  {deleteError && (
                    <p className="text-sm text-red-700 font-medium">{deleteError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setDeleteOpen(false); setDeleteConfirm(''); setDeleteError('') }}
                      className="flex-1 h-9 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Avbryt
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleteConfirm.trim() !== clientName.trim() || deleting}
                      className="flex-1 h-9 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Slett for godt
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* Footer — save button */}
        <div className="px-6 py-4 border-t border-gray-100 bg-white">
          {toast && (
            <div className={`mb-3 px-4 py-2.5 rounded-xl text-sm font-medium ${
              toast.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {toast.msg}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="w-full h-10 rounded-xl bg-[#2d8653] text-white text-sm font-semibold hover:bg-[#2d8653] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Lagre innstillinger
          </button>
        </div>
      </div>
    </>
  )
}
