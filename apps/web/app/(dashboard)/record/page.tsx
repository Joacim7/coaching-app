'use client'

import { useRef, useEffect } from 'react'
import { Monitor, MonitorOff, Circle, Square, Mic, MicOff, Video as CamIcon, VideoOff } from 'lucide-react'
import { useRecording } from '@/components/recording-provider'

// ── Helpers ───────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
function fmtTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
}

function CtrlBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-colors ${
        active ? 'text-white hover:bg-white/10' : 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium whitespace-nowrap">{label}</span>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecordPage() {
  const {
    stage, timer, micOn, camOn,
    screenStream, displaySurface,
    startScreen, startRecording, stopRecording, stopSharing,
    toggleMic, toggleCam,
  } = useRecording()

  // Local preview video — shows the screen share ON this page only.
  // This is separate from the hidden compositing video in RecordingProvider.
  const previewRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = previewRef.current
    if (!el || !screenStream) return
    el.srcObject = screenStream
    el.play().catch(() => {})
  }, [screenStream])

  // When sharing the entire monitor, hide the live preview so the screen
  // capture doesn't see a recursive copy of itself (mirror loop).
  // The recording canvas reads from the hidden video in RecordingProvider
  // and is unaffected by this opacity change.
  const isMonitor  = displaySurface === 'monitor'
  const inSession  = stage === 'preview' || stage === 'recording'

  return (
    <div className="-m-8 flex flex-col bg-gray-950" style={{ minHeight: 'calc(100vh - 64px)' }}>

      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 flex-shrink-0">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
          stage === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-red-600/60'
        }`} />
        <span className="text-white font-semibold text-sm tracking-wide">Nova Record</span>
        <span className="text-gray-500 text-xs">
          {stage === 'recording'
            ? `Tar opp · ${fmtTime(timer)}`
            : stage === 'preview'
            ? 'Klar til opptak'
            : 'Inaktiv'}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── IDLE ── */}
        {!inSession && (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center max-w-xs space-y-7">
              <div className="w-20 h-20 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center mx-auto">
                <Monitor className="w-9 h-9 text-gray-500" />
              </div>
              <div className="space-y-2.5">
                <h2 className="text-white text-xl font-bold">Start en ny økt</h2>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Del skjermen din — vindu, fane eller hele skjermen.
                  Webkameraet vises som en boble du kan flytte fritt,
                  og opptaket fortsetter mens du navigerer i appen.
                </p>
              </div>
              <button
                onClick={startScreen}
                className="w-full flex items-center justify-center gap-2.5 h-11 rounded-2xl bg-[#2d8653] hover:bg-[#2d8653] text-white font-semibold transition-colors"
              >
                <Monitor className="w-4 h-4" />
                Del skjerm
              </button>
            </div>
          </div>
        )}

        {/* ── SESSION ── */}
        {inSession && (
          <div className="flex-1 p-4 overflow-hidden">
            <div className="relative h-full rounded-2xl overflow-hidden bg-gray-900 border border-white/5">

              {/* Screen preview — always in DOM so srcObject persists,
                  but invisible when sharing a monitor to prevent mirror loop. */}
              <video
                ref={previewRef}
                muted
                playsInline
                style={{ opacity: isMonitor ? 0 : 1 }}
                className="absolute inset-0 w-full h-full object-contain transition-opacity"
              />

              {/* Monitor mode placeholder */}
              {isMonitor && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 select-none">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Monitor className="w-6 h-6 text-gray-500" />
                  </div>
                  <div className="text-center space-y-1 max-w-xs">
                    <p className="text-white text-sm font-semibold">Hele skjermen deles</p>
                    <p className="text-gray-500 text-xs leading-relaxed">
                      Forhåndsvisning skjult for å unngå speileffekt.
                      Opptaket fanger skjermen din normalt.
                    </p>
                  </div>
                  {stage === 'recording' && (
                    <div className="flex items-center gap-2 bg-red-600/20 border border-red-500/30 px-4 py-1.5 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-red-400 text-xs font-mono font-semibold">{fmtTime(timer)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* REC badge when preview is visible */}
              {stage === 'recording' && !isMonitor && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-1.5 rounded-full shadow-lg pointer-events-none">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-xs font-bold tracking-wider">REC</span>
                  <span className="text-white/80 text-xs font-mono">{fmtTime(timer)}</span>
                </div>
              )}

              {/* Navigate-away hint when recording */}
              {stage === 'recording' && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-sm border border-white/10 px-4 py-2 rounded-xl pointer-events-none">
                  <p className="text-gray-400 text-xs text-center">
                    Naviger fritt i appen — opptaket fortsetter i bakgrunnen
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Control bar */}
      {inSession && (
        <div className="flex-shrink-0 border-t border-white/5 px-6 py-4">
          <div className="flex items-center justify-center gap-2">
            <CtrlBtn
              active={micOn}
              onClick={toggleMic}
              icon={micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              label={micOn ? 'Mikrofon' : 'Av'}
            />
            <CtrlBtn
              active={camOn}
              onClick={toggleCam}
              icon={camOn ? <CamIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              label={camOn ? 'Kamera' : 'Av'}
            />

            <div className="w-px h-10 bg-white/10 mx-2" />

            {stage === 'preview' ? (
              <button
                onClick={startRecording}
                disabled={!screenStream}
                className="flex items-center gap-2 px-7 h-11 rounded-2xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-semibold text-sm transition-colors shadow-lg shadow-red-900/30"
              >
                <Circle className="w-4 h-4 fill-white" />
                Start opptak
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-7 h-11 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-red-900/30"
              >
                <Square className="w-4 h-4 fill-white" />
                Stopp opptak
              </button>
            )}

            <div className="w-px h-10 bg-white/10 mx-2" />

            <button
              onClick={stopSharing}
              className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <MonitorOff className="w-5 h-5" />
              <span className="text-[10px] font-medium">Stopp deling</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
