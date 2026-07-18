'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  User, CreditCard, Receipt, Bell, Scale,
  Globe, Shield, Camera, Check, Loader2, ChevronRight, ExternalLink,
} from 'lucide-react'

interface Props {
  userId: string
  email: string
  initialProfile: {
    full_name: string
    avatar_url: string | null
    phone: string
    weight_unit: 'kg' | 'lb'
    distance_unit: 'km' | 'mi'
    language: string
  }
}

function SectionCard({ icon: Icon, title, children }: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
        <div className="w-8 h-8 rounded-lg bg-[#ebf5ef] flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-[#1a5c3a]" />
        </div>
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function ToggleRow({ label, sub, checked, onChange }: {
  label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-[#2d8653]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

function UnitToggle({ value, options, onChange }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            value === opt.value ? 'bg-white text-[#1a5c3a] shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function ExternalRow({ label, sub, href }: { label: string; sub?: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 group"
    >
      <div>
        <p className="text-sm font-medium text-gray-800 group-hover:text-[#1a5c3a]">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-[#2d8653]" />
    </a>
  )
}

function PlaceholderRow({ label, sub, badge }: { label: string; sub?: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {badge && (
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#ebf5ef] text-[#1a5c3a]">{badge}</span>
      )}
      {!badge && <ChevronRight className="w-4 h-4 text-gray-300" />}
    </div>
  )
}

export default function SettingsView({ userId, email, initialProfile }: Props) {
  const supabase = createClient()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [name,    setName]    = useState(initialProfile.full_name)
  const [phone,   setPhone]   = useState(initialProfile.phone)
  const [avatar,  setAvatar]  = useState<string | null>(initialProfile.avatar_url)
  const [weightU, setWeightU] = useState<'kg' | 'lb'>(initialProfile.weight_unit)
  const [distU,   setDistU]   = useState<'km' | 'mi'>(initialProfile.distance_unit)
  const [lang,    setLang]    = useState(initialProfile.language)

  const [notifNewCheckin,   setNotifNewCheckin]   = useState(true)
  const [notifWeeklyReport, setNotifWeeklyReport] = useState(true)
  const [notifNewLead,      setNotifNewLead]      = useState(true)

  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)

  async function handleSaveProfile() {
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ full_name: name.trim(), phone: phone.trim() || null })
      .eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSavePreferences() {
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ weight_unit: weightU, distance_unit: distU, language: lang })
      .eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImg(true)
    const ext  = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`
    await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${data.publicUrl}?t=${Date.now()}`
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
    setAvatar(url)
    setUploadingImg(false)
  }

  const initials = name
    ? name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : email[0]?.toUpperCase() ?? '?'

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1a5c3a]">Innstillinger</h1>
        <p className="text-sm text-gray-500 mt-1">Administrer konto, preferanser og varsler</p>
      </div>

      {/* ── 1. Profilinnstillinger ── */}
      <SectionCard icon={User} title="Profilinnstillinger">
        {/* Avatar */}
        <div className="flex items-center gap-5 mb-6">
          <div className="relative">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="Profilbilde" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#cdeee3] flex items-center justify-center text-2xl font-bold text-[#1a5c3a]">
                {initials}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingImg}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#1a5c3a] text-white flex items-center justify-center shadow-md hover:bg-[#2d8653] transition-colors"
            >
              {uploadingImg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{name || 'Navn ikke satt'}</p>
            <p className="text-sm text-gray-400">{email}</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs text-[#2d8653] hover:text-[#1a5c3a] font-medium mt-1"
            >
              Endre bilde
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Fullt navn</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
              placeholder="Ola Nordmann"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">E-post</label>
            <input
              value={email}
              disabled
              className="w-full h-10 px-3 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">E-post endres via Supabase Auth</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Telefon</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
              placeholder="+47 123 45 678"
            />
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 h-10 px-5 rounded-xl text-white text-sm font-semibold transition-all [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)] hover:[background:#1a5c3a] disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
            {saving ? 'Lagrer...' : saved ? 'Lagret!' : 'Lagre profil'}
          </button>
        </div>
      </SectionCard>

      {/* ── 2. Abonnement ── */}
      <SectionCard icon={CreditCard} title="Abonnement">
        <div className="flex items-center justify-between mb-4 p-4 rounded-xl bg-[#ebf5ef] border border-[#cdeee3]">
          <div>
            <p className="font-semibold text-[#1a5c3a]">Pro-plan</p>
            <p className="text-sm text-[#2d8653] mt-0.5">Ubegrenset klienter · AI-matplaner · Opptak</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#cdeee3] text-[#1a5c3a]">Aktiv</span>
        </div>
        <PlaceholderRow label="Endre plan" sub="Oppgrader eller nedgrader abonnementet" />
        <PlaceholderRow label="Betalingsmetode" sub="Visa •••• 4242" />
        <PlaceholderRow label="Neste fornyelse" sub="1. august 2026" badge="299 kr/mnd" />
        <div className="mt-4">
          <button className="text-sm text-gray-400 hover:text-red-500 transition-colors">
            Avslutt abonnement
          </button>
        </div>
      </SectionCard>

      {/* ── 3. Fakturaer ── */}
      <SectionCard icon={Receipt} title="Fakturaer">
        {[
          { date: '1. jul 2026', amount: '299 kr', status: 'Betalt' },
          { date: '1. jun 2026', amount: '299 kr', status: 'Betalt' },
          { date: '1. mai 2026', amount: '299 kr', status: 'Betalt' },
        ].map((inv, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
            <div>
              <p className="text-sm font-medium text-gray-800">Nova Performance Pro</p>
              <p className="text-xs text-gray-400 mt-0.5">{inv.date}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">{inv.amount}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#ebf5ef] text-[#1a5c3a]">{inv.status}</span>
              <button className="text-xs text-[#2d8653] hover:text-[#1a5c3a] font-medium">Last ned</button>
            </div>
          </div>
        ))}
        <p className="text-xs text-gray-400 mt-3">Fakturaer sendes til {email}</p>
      </SectionCard>

      {/* ── 4. Varslingsadministrasjon ── */}
      <SectionCard icon={Bell} title="Varslingsadministrasjon">
        <p className="text-xs text-gray-400 mb-3">Velg hvilke hendelser du vil varsles om</p>
        <ToggleRow
          label="Ny check-in innsendt"
          sub="Varsle meg når en klient sender inn check-in"
          checked={notifNewCheckin}
          onChange={setNotifNewCheckin}
        />
        <ToggleRow
          label="Ukentlig klientrapport"
          sub="Oppsummering av alle klienters uke"
          checked={notifWeeklyReport}
          onChange={setNotifWeeklyReport}
        />
        <ToggleRow
          label="Ny lead"
          sub="Varsle meg om nye leads fra oppstartslenken"
          checked={notifNewLead}
          onChange={setNotifNewLead}
        />
      </SectionCard>

      {/* ── 5. Enheter og mål ── */}
      <SectionCard icon={Scale} title="Enheter og mål">
        <p className="text-xs text-gray-400 mb-4">Gjelder for alle klienter i dashboardet</p>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Vektenhet</p>
              <p className="text-xs text-gray-400 mt-0.5">Brukes i check-ins og progresjon</p>
            </div>
            <UnitToggle
              value={weightU}
              options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
              onChange={v => setWeightU(v as 'kg' | 'lb')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Avstandsenhet</p>
              <p className="text-xs text-gray-400 mt-0.5">Brukes i treningsplaner og skritt</p>
            </div>
            <UnitToggle
              value={distU}
              options={[{ value: 'km', label: 'km' }, { value: 'mi', label: 'mi' }]}
              onChange={v => setDistU(v as 'km' | 'mi')}
            />
          </div>
        </div>
        <button
          onClick={handleSavePreferences}
          disabled={saving}
          className="flex items-center gap-2 h-10 px-5 rounded-xl text-white text-sm font-semibold mt-5 transition-all [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)] hover:[background:#1a5c3a] disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
          {saving ? 'Lagrer...' : saved ? 'Lagret!' : 'Lagre preferanser'}
        </button>
      </SectionCard>

      {/* ── 6. Språk ── */}
      <SectionCard icon={Globe} title="Språk">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Grensesnittspråk</p>
            <p className="text-xs text-gray-400 mt-0.5">Språket som brukes i dashboardet</p>
          </div>
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653] bg-white"
          >
            <option value="nb">🇳🇴 Norsk (bokmål)</option>
            <option value="nn">🇳🇴 Norsk (nynorsk)</option>
            <option value="en">🇬🇧 English</option>
            <option value="sv">🇸🇪 Svenska</option>
            <option value="da">🇩🇰 Dansk</option>
          </select>
        </div>
      </SectionCard>

      {/* ── 7. Juridisk ── */}
      <SectionCard icon={Shield} title="Juridisk">
        <ExternalRow
          label="Personvernerklæring"
          sub="Hvordan vi behandler dine data"
          href="https://novaperformance.no/personvern"
        />
        <ExternalRow
          label="Vilkår for bruk"
          sub="Avtalevilkår for Nova Performance"
          href="https://novaperformance.no/vilkar"
        />
        <ExternalRow
          label="Databehandleravtale (DPA)"
          sub="GDPR-avtale for behandling av klientdata"
          href="https://novaperformance.no/dpa"
        />
      </SectionCard>

    </div>
  )
}
