'use client'

import { useState } from 'react'
import { Play, Download, Trash2, Video, X, Clock, HardDrive, Plus, Link2, Check } from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecordingRow {
  id: string
  title: string
  duration_seconds: number | null
  file_path: string | null
  file_size_bytes: number | null
  created_at: string
  share_url?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')

function formatDuration(s: number | null) {
  if (!s) return '--'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${pad(m)}:${pad(sec)}`
    : `${pad(m)}:${pad(sec)}`
}

function formatBytes(b: number | null) {
  if (!b) return '--'
  return b < 1024 * 1024
    ? `${(b / 1024).toFixed(0)} KB`
    : `${(b / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers that block clipboard without HTTPS
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      title="Kopier delbar link"
      className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
        copied
          ? 'bg-green-50 text-green-700'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          Kopiert!
        </>
      ) : (
        <>
          <Link2 className="w-3.5 h-3.5" />
          Del link
        </>
      )}
    </button>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  initialRecordings: RecordingRow[]
}

export function RecordingsView({ initialRecordings }: Props) {
  const [recordings, setRecordings] = useState<RecordingRow[]>(initialRecordings)
  const [playing, setPlaying]       = useState<RecordingRow | null>(null)
  const [deleting, setDeleting]     = useState<string | null>(null)

  async function handleDelete(rec: RecordingRow) {
    if (!confirm(`Slett "${rec.title}"? Dette kan ikke angres.`)) return
    setDeleting(rec.id)
    const res = await fetch(`/api/recordings/${rec.id}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) {
      setRecordings(prev => prev.filter(r => r.id !== rec.id))
    }
  }

  function handleDownload(rec: RecordingRow) {
    if (!rec.share_url) return
    const a = document.createElement('a')
    a.href     = rec.share_url
    a.download = `${rec.title}.webm`
    a.click()
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a5c3a]">Mine opptak</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Opptak fra dine coachingøkter
          </p>
        </div>
        <Link
          href="/record"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-white text-sm font-semibold transition-all [background:linear-gradient(to_right,#1a5c3a,#6ecfb0)] hover:[background:#1a5c3a]"
        >
          <Plus className="w-4 h-4" />
          Nytt opptak
        </Link>
      </div>

      {/* Empty state */}
      {recordings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Video className="w-7 h-7 text-gray-300" />
          </div>
          <p className="font-semibold text-gray-500">Ingen opptak ennå</p>
          <p className="text-sm text-gray-400 mt-1">
            Gå til{' '}
            <Link href="/record" className="text-[#2d8653] hover:underline">
              Record
            </Link>{' '}
            for å starte et opptak
          </p>
        </div>
      )}

      {/* List */}
      {recordings.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {recordings.map((rec, i) => (
            <div
              key={rec.id}
              className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${
                i > 0 ? 'border-t border-gray-100' : ''
              }`}
            >
              {/* Thumbnail */}
              <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
                <Video className="w-5 h-5 text-gray-500" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{rec.title}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {formatDuration(rec.duration_seconds)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <HardDrive className="w-3 h-3" />
                    {formatBytes(rec.file_size_bytes)}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(rec.created_at)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {rec.share_url && (
                  <button
                    onClick={() => setPlaying(rec)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#ebf5ef] text-[#1a5c3a] text-xs font-semibold hover:bg-[#cdeee3] transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Spill av
                  </button>
                )}
                {rec.share_url && (
                  <CopyLinkButton url={rec.share_url} />
                )}
                {rec.share_url && (
                  <button
                    onClick={() => handleDownload(rec)}
                    title="Last ned"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(rec)}
                  disabled={deleting === rec.id}
                  title="Slett"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Playback modal */}
      {playing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-950 rounded-2xl overflow-hidden w-full max-w-4xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <p className="text-white font-semibold text-sm truncate">{playing.title}</p>
              <button
                onClick={() => setPlaying(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <video
              src={playing.share_url ?? undefined}
              controls
              autoPlay
              className="w-full max-h-[70vh] bg-black"
            />
          </div>
        </div>
      )}
    </div>
  )
}
