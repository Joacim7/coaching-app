'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  User, CreditCard, Receipt, Bell, Scale,
  Globe, Shield, Camera, Check, Loader2, ChevronRight, ExternalLink,
} from 'lucide-react'
import { planBySlug } from '@/lib/plans'
import { useLocale } from '@/components/locale-provider'
import type { Locale } from '@/lib/i18n/translations'

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
  billing: {
    planSlug: string
    hasStripeCustomer: boolean
    renewalDateIso: string | null
    invoices: {
      id: string
      dateIso: string
      amountKr: number
      status: string
      downloadUrl: string | null
    }[]
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

export default function SettingsView({ userId, email, initialProfile, billing }: Props) {
  const supabase = createClient()
  const fileRef  = useRef<HTMLInputElement>(null)
  const { t, setLocale } = useLocale()

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

  function handleLanguageChange(value: string) {
    setLang(value)
    setLocale(value as Locale)
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
        <h1 className="text-2xl font-bold text-[#1a5c3a]">{t('settings.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* ── 1. Profilinnstillinger ── */}
      <SectionCard icon={User} title={t('settings.profile.title')}>
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
            <p className="font-semibold text-gray-900">{name || t('settings.profile.nameNotSet')}</p>
            <p className="text-sm text-gray-400">{email}</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs text-[#2d8653] hover:text-[#1a5c3a] font-medium mt-1"
            >
              {t('settings.profile.changePhoto')}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t('settings.profile.fullName')}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
              placeholder={t('settings.profile.fullNamePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t('settings.profile.email')}</label>
            <input
              value={email}
              disabled
              className="w-full h-10 px-3 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">{t('settings.profile.emailHint')}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t('settings.profile.phone')}</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653]"
              placeholder={t('settings.profile.phonePlaceholder')}
            />
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 h-10 px-5 rounded-xl text-white text-sm font-semibold transition-all [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)] hover:[background:#1a5c3a] disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
            {saving ? t('settings.saving') : saved ? t('settings.saved') : t('settings.profile.save')}
          </button>
        </div>
      </SectionCard>

      {/* ── 2. Abonnement ── */}
      <SectionCard icon={CreditCard} title={t('settings.subscription.title')}>
        {(() => {
          const plan = planBySlug(billing.planSlug)
          const isActive = billing.planSlug !== 'free'
          return (
            <>
              <div className="flex items-center justify-between mb-4 p-4 rounded-xl bg-[#ebf5ef] border border-[#cdeee3]">
                <div>
                  <p className="font-semibold text-[#1a5c3a]">{plan.displayName}-plan</p>
                  <p className="text-sm text-[#2d8653] mt-0.5">{plan.priceKr} kr/mnd</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#cdeee3] text-[#1a5c3a]">
                  {isActive ? t('settings.subscription.active') : t('settings.subscription.none')}
                </span>
              </div>
              {isActive && (
                <>
                  <PlaceholderRow
                    label={t('settings.subscription.nextRenewal')}
                    sub={
                      billing.renewalDateIso
                        ? new Date(billing.renewalDateIso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
                        : t('settings.subscription.notAvailable')
                    }
                    badge={`${plan.priceKr} kr/mnd`}
                  />
                  <Link
                    href="/pricing"
                    className="mt-4 flex items-center justify-center gap-2 h-10 px-5 rounded-xl text-white text-sm font-semibold transition-all [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)] hover:[background:#1a5c3a]"
                  >
                    {t('settings.subscription.upgrade')}
                  </Link>
                </>
              )}
            </>
          )
        })()}
      </SectionCard>

      {/* ── 3. Fakturaer ── */}
      <SectionCard icon={Receipt} title={t('settings.invoices.title')}>
        {!billing.hasStripeCustomer || billing.invoices.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">{t('settings.invoices.none')}</p>
        ) : (
          <>
            {billing.invoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">Nova Performance</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(inv.dateIso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700">{inv.amountKr} kr</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#ebf5ef] text-[#1a5c3a]">{inv.status}</span>
                  {inv.downloadUrl ? (
                    <a
                      href={inv.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#2d8653] hover:text-[#1a5c3a] font-medium"
                    >
                      {t('settings.invoices.download')}
                    </a>
                  ) : (
                    <span className="text-xs text-gray-300">{t('settings.invoices.download')}</span>
                  )}
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400 mt-3">{t('settings.invoices.sentTo')} {email}</p>
          </>
        )}
      </SectionCard>

      {/* ── 4. Varslingsadministrasjon ── */}
      <SectionCard icon={Bell} title={t('settings.notifications.title')}>
        <p className="text-xs text-gray-400 mb-3">{t('settings.notifications.subtitle')}</p>
        <ToggleRow
          label={t('settings.notifications.newCheckin')}
          sub={t('settings.notifications.newCheckinSub')}
          checked={notifNewCheckin}
          onChange={setNotifNewCheckin}
        />
        <ToggleRow
          label={t('settings.notifications.weeklyReport')}
          sub={t('settings.notifications.weeklyReportSub')}
          checked={notifWeeklyReport}
          onChange={setNotifWeeklyReport}
        />
        <ToggleRow
          label={t('settings.notifications.newLead')}
          sub={t('settings.notifications.newLeadSub')}
          checked={notifNewLead}
          onChange={setNotifNewLead}
        />
      </SectionCard>

      {/* ── 5. Enheter og mål ── */}
      <SectionCard icon={Scale} title={t('settings.units.title')}>
        <p className="text-xs text-gray-400 mb-4">{t('settings.units.subtitle')}</p>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">{t('settings.units.weight')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('settings.units.weightSub')}</p>
            </div>
            <UnitToggle
              value={weightU}
              options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
              onChange={v => setWeightU(v as 'kg' | 'lb')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">{t('settings.units.distance')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('settings.units.distanceSub')}</p>
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
          {saving ? t('settings.saving') : saved ? t('settings.saved') : t('settings.units.save')}
        </button>
      </SectionCard>

      {/* ── 6. Språk ── */}
      <SectionCard icon={Globe} title={t('settings.language.title')}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">{t('settings.language.label')}</p>
          </div>
          <select
            value={lang}
            onChange={e => handleLanguageChange(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d8653] bg-white"
          >
            <option value="nb">🇳🇴 Norsk (bokmål)</option>
            <option value="en">🇬🇧 English</option>
          </select>
        </div>
      </SectionCard>

      {/* ── 7. Juridisk ── */}
      <SectionCard icon={Shield} title={t('settings.legal.title')}>
        <ExternalRow
          label={t('settings.legal.privacy')}
          sub={t('settings.legal.privacySub')}
          href="https://novaperformance.no/personvern"
        />
        <ExternalRow
          label={t('settings.legal.terms')}
          sub={t('settings.legal.termsSub')}
          href="https://novaperformance.no/vilkar"
        />
        <ExternalRow
          label={t('settings.legal.dpa')}
          sub={t('settings.legal.dpaSub')}
          href="https://novaperformance.no/dpa"
        />
      </SectionCard>

    </div>
  )
}
