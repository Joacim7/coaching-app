'use client'

import {
  createContext, useContext, useRef, useState, useEffect,
  type ReactNode,
} from 'react'
import {
  Mic, MicOff, Video as CamIcon, VideoOff, Square,
  Download, Save, AlertCircle, Monitor, X, Circle,
  MonitorCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecordingStage = 'idle' | 'preview' | 'recording' | 'saving'

type BubblePos =
  | { pinned: true;  right: number; bottom: number }
  | { pinned: false; left:  number; top:    number }

// ── Context ───────────────────────────────────────────────────────────────────

export interface RecordingContextValue {
  stage:            RecordingStage
  timer:            number
  micOn:            boolean
  camOn:            boolean
  screenStream:     MediaStream | null
  webcamStream:     MediaStream | null
  displaySurface:   string | null
  recordModalOpen:  boolean
  startScreen:      () => Promise<void>
  startRecording:   () => void
  stopRecording:    () => void
  stopSharing:      () => void
  toggleMic:        () => void
  toggleCam:        () => void
  openRecordModal:  () => void
  closeRecordModal: () => void
}

const Ctx = createContext<RecordingContextValue | null>(null)

export function useRecording() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useRecording must be inside RecordingProvider')
  return c
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
function fmtTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0
    ? `${h}:${pad(m)}:${pad(s % 60)}`
    : `${pad(m)}:${pad(s % 60)}`
}
function fmtBytes(b: number) {
  return b < 1024 * 1024
    ? `${(b / 1024).toFixed(0)} KB`
    : `${(b / 1024 / 1024).toFixed(1)} MB`
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function RecordingProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  const [screenStream,    setScreenStream]   = useState<MediaStream | null>(null)
  const [webcamStream,    setWebcamStream]   = useState<MediaStream | null>(null)
  const [stage,           setStage]          = useState<RecordingStage>('idle')
  const [micOn,           setMicOn]          = useState(true)
  const [camOn,           setCamOn]          = useState(true)
  const [timer,           setTimer]          = useState(0)
  const [displaySurface,  setDisplaySurface] = useState<string | null>(null)
  const [recordModalOpen, setRecordModalOpen] = useState(false)

  const [blob,      setBlob]      = useState<Blob | null>(null)
  const [recTitle,  setRecTitle]  = useState('')
  const [upErr,     setUpErr]     = useState('')
  const [upLoading, setUpLoading] = useState(false)

  const [bubblePos, setBubblePos] = useState<BubblePos>({ pinned: true, right: 24, bottom: 88 })

  // Refs that must survive navigation
  const hiddenScreenRef = useRef<HTMLVideoElement>(null) // for canvas compositing
  const webcamVidRef    = useRef<HTMLVideoElement>(null) // in the floating bubble
  const canvasRef       = useRef<HTMLCanvasElement>(null)
  const recRef          = useRef<MediaRecorder | null>(null)
  const chunksRef       = useRef<Blob[]>([])
  const animRef         = useRef<number>(0)
  const intervalRef     = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const timerValRef     = useRef(0)
  const micOnRef        = useRef(true)          // stable ref for closure inside startRecording
  const bubbleRef       = useRef<HTMLDivElement>(null)
  const dragRef         = useRef<{
    startX: number; startY: number; startLeft: number; startTop: number
  } | null>(null)

  // Keep mic ref in sync
  useEffect(() => { micOnRef.current = micOn }, [micOn])

  // Wire streams to hidden video elements
  useEffect(() => {
    const el = hiddenScreenRef.current
    if (!el || !screenStream) return
    el.srcObject = screenStream
    el.play().catch(() => {})
  }, [screenStream])

  useEffect(() => {
    const el = webcamVidRef.current
    if (!el || !webcamStream) return
    el.srcObject = webcamStream
    el.play().catch(() => {})
  }, [webcamStream])

  // Cleanup animation + timer on unmount
  useEffect(() => () => {
    cancelAnimationFrame(animRef.current)
    clearInterval(intervalRef.current)
  }, [])

  // ── Clean up all streams (shared helper) ───────────────────────────────────
  function releaseStreams(streams: { screen: MediaStream | null; webcam: MediaStream | null }) {
    streams.screen?.getTracks().forEach(t => t.stop())
    streams.webcam?.getTracks().forEach(t => t.stop())
  }

  // ── Start screen share ─────────────────────────────────────────────────────
  async function startScreen() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: true,
      })
      const track    = stream.getVideoTracks()[0]
      const settings = track.getSettings()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDisplaySurface((settings as any).displaySurface ?? null)

      const canvas  = canvasRef.current!
      canvas.width  = settings.width  || 1280
      canvas.height = settings.height || 720

      track.addEventListener('ended', () => {
        // User stopped sharing from OS picker → move to idle (or keep recording if active)
        setScreenStream(null)
        setDisplaySurface(null)
        cancelAnimationFrame(animRef.current)
        setStage(s => (s === 'recording' ? s : 'idle'))
      })

      setScreenStream(stream)
      setStage('preview')

      // Webcam is optional — don't block on failure
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        setWebcamStream(cam)
      } catch { /* user has no webcam or denied */ }
    } catch { /* user cancelled the picker */ }
  }

  // ── Start recording ────────────────────────────────────────────────────────
  function startRecording() {
    const canvas      = canvasRef.current
    const screenVideo = hiddenScreenRef.current
    if (!canvas || !screenVideo || !screenStream) return

    const ctx = canvas.getContext('2d')!

    // Draw loop: composites screen + webcam circle into the canvas every frame.
    // canvas.drawImage reads decoded video frames regardless of element visibility.
    const draw = () => {
      const wv = webcamVidRef.current
      ctx.fillStyle = '#111827'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (screenVideo.readyState >= 2) {
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height)
      }

      if (wv && wv.readyState >= 2) {
        const size   = Math.floor(canvas.width * 0.15)
        const margin = 20
        const cx = canvas.width  - size - margin + size / 2
        const cy = canvas.height - size - margin + size / 2
        const x  = canvas.width  - size - margin
        const y  = canvas.height - size - margin
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(wv, x, y, size, size)
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(draw)
    }
    animRef.current = requestAnimationFrame(draw)

    // Build the stream to record: canvas video + audio tracks
    const cs = canvas.captureStream(30)
    screenStream.getAudioTracks().forEach(t => cs.addTrack(t))
    if (micOnRef.current) webcamStream?.getAudioTracks().forEach(t => cs.addTrack(t))

    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/webm'

    chunksRef.current = []
    const rec = new MediaRecorder(cs, { mimeType: mime, videoBitsPerSecond: 3_000_000 })

    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      cancelAnimationFrame(animRef.current)
      setBlob(new Blob(chunksRef.current, { type: mime }))
      const now = new Date()
      setRecTitle(
        `Økt ${now.toLocaleDateString('nb-NO')} ` +
        `${now.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`
      )
      setStage('saving')
    }

    rec.start(1000)
    recRef.current = rec

    timerValRef.current = 0
    setTimer(0)
    setStage('recording')
    setRecordModalOpen(false)
    intervalRef.current = setInterval(() => {
      timerValRef.current += 1
      setTimer(t => t + 1)
    }, 1000)
  }

  // ── Stop recording ─────────────────────────────────────────────────────────
  function stopRecording() {
    clearInterval(intervalRef.current)
    recRef.current?.stop()
    // onstop fires asynchronously → sets stage='saving'
  }

  // ── Stop sharing (abort without saving) ───────────────────────────────────
  function stopSharing() {
    cancelAnimationFrame(animRef.current)
    clearInterval(intervalRef.current)
    if (recRef.current?.state === 'recording') {
      // Prevent onstop from showing save dialog
      recRef.current.ondataavailable = null
      recRef.current.onstop = null
      recRef.current.stop()
    }
    releaseStreams({ screen: screenStream, webcam: webcamStream })
    setScreenStream(null)
    setWebcamStream(null)
    setDisplaySurface(null)
    setStage('idle')
    setTimer(0)
    setBubblePos({ pinned: true, right: 24, bottom: 88 })
  }

  // ── Record modal ──────────────────────────────────────────────────────────
  function openRecordModal()  { setRecordModalOpen(true)  }
  function closeRecordModal() {
    if (stage === 'preview') stopSharing()
    setRecordModalOpen(false)
  }

  // ── Mic / Camera toggles ──────────────────────────────────────────────────
  function toggleMic() {
    webcamStream?.getAudioTracks().forEach(t => { t.enabled = !micOn })
    setMicOn(v => !v)
  }
  function toggleCam() {
    webcamStream?.getVideoTracks().forEach(t => { t.enabled = !camOn })
    setCamOn(v => !v)
  }

  // ── Bubble drag ────────────────────────────────────────────────────────────
  function onBubblePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Don't start drag when clicking a control button
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const el = bubbleRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startLeft: r.left, startTop: r.top,
    }
  }
  function onBubblePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    const { startX, startY, startLeft, startTop } = dragRef.current
    const left = Math.max(8, Math.min(window.innerWidth  - 136, startLeft + (e.clientX - startX)))
    const top  = Math.max(8, Math.min(window.innerHeight - 200, startTop  + (e.clientY - startY)))
    setBubblePos({ pinned: false, left, top })
  }
  function onBubblePointerUp() { dragRef.current = null }

  // ── Save to Supabase Storage ───────────────────────────────────────────────
  async function saveRecording() {
    if (!blob) return
    setUpLoading(true)
    setUpErr('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Ikke innlogget')

      const path = `${user.id}/${Date.now()}.webm`
      const { error: upE } = await supabase.storage
        .from('coach-recordings')
        .upload(path, blob, { contentType: 'video/webm' })
      if (upE) throw new Error(`Opplasting feilet: ${upE.message}`)

      // Public bucket → permanent shareable URL (no expiry)
      const { data: urlData } = supabase.storage
        .from('coach-recordings')
        .getPublicUrl(path)

      const res = await fetch('/api/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:            recTitle.trim() || 'Opptak',
          duration_seconds: timerValRef.current,
          file_path:        path,
          file_size_bytes:  blob.size,
          share_url:        urlData.publicUrl,
        }),
      })
      if (!res.ok) throw new Error('Kunne ikke lagre metadata')

      releaseStreams({ screen: screenStream, webcam: webcamStream })
      setScreenStream(null)
      setWebcamStream(null)
      setStage('idle')
      setBlob(null)
      router.push('/recordings')
    } catch (err) {
      setUpErr(err instanceof Error ? err.message : 'Ukjent feil')
    } finally {
      setUpLoading(false)
    }
  }

  function downloadBlob() {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${recTitle || 'opptak'}.webm`; a.click()
    URL.revokeObjectURL(url)
  }

  function discardRecording() {
    setBlob(null)
    releaseStreams({ screen: screenStream, webcam: webcamStream })
    setScreenStream(null)
    setWebcamStream(null)
    setStage('idle')
    setTimer(0)
    setBubblePos({ pinned: true, right: 24, bottom: 88 })
  }

  const inSession = stage === 'preview' || stage === 'recording'

  const surfaceLabel = displaySurface === 'monitor' ? 'Hele skjermen'
    : displaySurface === 'window' ? 'Vindu'
    : displaySurface === 'browser' ? 'Nettleserfane'
    : displaySurface ? displaySurface : 'Skjerm valgt'

  const ctxValue: RecordingContextValue = {
    stage, timer, micOn, camOn, screenStream, webcamStream, displaySurface,
    recordModalOpen,
    startScreen, startRecording, stopRecording, stopSharing, toggleMic, toggleCam,
    openRecordModal, closeRecordModal,
  }

  return (
    <Ctx.Provider value={ctxValue}>
      {children}

      {/* ── Hidden elements for canvas compositing ─────────────────────────
          These never unmount (they're in the provider, not the Record page),
          so recording continues even while the user navigates elsewhere.     */}
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ position: 'fixed', left: -9999, top: 0, width: 1, height: 1 }}
      />
      <video
        ref={hiddenScreenRef}
        muted
        playsInline
        aria-hidden
        style={{ position: 'fixed', left: -9999, top: 0, width: 1, height: 1 }}
      />

      {/* ── Floating webcam bubble (persists across navigation) ────────────
          position:fixed so it floats above the sidebar and all page content. */}
      {inSession && (
        <div
          ref={bubbleRef}
          onPointerDown={onBubblePointerDown}
          onPointerMove={onBubblePointerMove}
          onPointerUp={onBubblePointerUp}
          style={{
            position: 'fixed',
            zIndex: 9998,
            cursor: dragRef.current ? 'grabbing' : 'grab',
            ...(bubblePos.pinned
              ? { right: bubblePos.right, bottom: bubblePos.bottom }
              : { left:  bubblePos.left,  top:    bubblePos.top }),
          }}
          className="select-none"
        >
          {/* Webcam circle */}
          <div className="relative w-[120px] h-[120px] rounded-full overflow-hidden border-[3px] border-white/30 bg-gray-900 shadow-2xl ring-2 ring-black/30">
            {webcamStream && (
              <video
                ref={webcamVidRef}
                muted
                playsInline
                style={{ opacity: camOn ? 1 : 0 }}
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              />
            )}
            {(!webcamStream || !camOn) && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <VideoOff className="w-6 h-6 text-gray-600" />
              </div>
            )}
          </div>

          {/* REC timer badge */}
          {stage === 'recording' && (
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-red-600 px-2.5 py-0.5 rounded-full shadow-lg whitespace-nowrap pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-white text-[10px] font-mono font-bold">{fmtTime(timer)}</span>
            </div>
          )}

          {/* Controls — always visible below the circle */}
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2">
            <div className="flex items-center gap-1 bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-xl px-2 py-1.5 shadow-xl">
              <button
                onClick={() => toggleMic()}
                className={`p-1.5 rounded-lg transition-colors ${
                  micOn ? 'text-white hover:bg-white/10' : 'text-red-400 bg-red-500/20 hover:bg-red-500/30'
                }`}
                title={micOn ? 'Slå av mikrofon' : 'Slå på mikrofon'}
              >
                {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => toggleCam()}
                className={`p-1.5 rounded-lg transition-colors ${
                  camOn ? 'text-white hover:bg-white/10' : 'text-red-400 bg-red-500/20 hover:bg-red-500/30'
                }`}
                title={camOn ? 'Slå av kamera' : 'Slå på kamera'}
              >
                {camOn ? <CamIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
              {stage === 'recording' && (
                <button
                  onClick={() => stopRecording()}
                  className="flex items-center gap-1 pl-1.5 pr-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
                  title="Stopp opptak"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span className="text-[10px] font-semibold">Stopp</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Record launch modal ───────────────────────────────────────────── */}
      {recordModalOpen && (
        <div
          className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeRecordModal() }}
        >
          <div className="bg-gray-950 rounded-2xl shadow-2xl w-full max-w-sm border border-white/10 overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                stage === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-red-600/50'
              }`} />
              <span className="text-white font-semibold text-sm flex-1">Nova Record</span>
              {stage === 'recording' && (
                <span className="text-red-400 text-xs font-mono mr-2">{fmtTime(timer)}</span>
              )}
              <button
                onClick={closeRecordModal}
                className="text-gray-500 hover:text-white transition-colors p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">

              {/* Mic + Camera toggles */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={toggleMic}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                    micOn
                      ? 'bg-white/10 text-white hover:bg-white/[.15]'
                      : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                  }`}
                >
                  {micOn ? <Mic className="w-4 h-4 flex-shrink-0" /> : <MicOff className="w-4 h-4 flex-shrink-0" />}
                  <span className="truncate">Mikrofon</span>
                  <span className="ml-auto text-[10px] opacity-60">{micOn ? 'På' : 'Av'}</span>
                </button>
                <button
                  onClick={toggleCam}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                    camOn
                      ? 'bg-white/10 text-white hover:bg-white/[.15]'
                      : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                  }`}
                >
                  {camOn ? <CamIcon className="w-4 h-4 flex-shrink-0" /> : <VideoOff className="w-4 h-4 flex-shrink-0" />}
                  <span className="truncate">Kamera</span>
                  <span className="ml-auto text-[10px] opacity-60">{camOn ? 'På' : 'Av'}</span>
                </button>
              </div>

              {/* Screen source selector */}
              {stage === 'idle' && (
                <button
                  onClick={startScreen}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-dashed border-white/15 text-gray-400 hover:text-white hover:border-white/30 hover:bg-white/5 transition-colors text-sm"
                >
                  <Monitor className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">Velg fane / skjerm / vindu</span>
                </button>
              )}

              {(stage === 'preview' || stage === 'recording') && (
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[#2d8653]/10 border border-[#2d8653]/20">
                  <MonitorCheck className="w-4 h-4 text-[#6ecfb0] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{surfaceLabel}</p>
                    <p className="text-xs text-gray-500">Klar til opptak</p>
                  </div>
                  {stage !== 'recording' && (
                    <button
                      onClick={stopSharing}
                      className="text-xs text-gray-500 hover:text-white transition-colors flex-shrink-0"
                    >
                      Endre
                    </button>
                  )}
                </div>
              )}

              {/* Primary action */}
              {stage === 'idle' && (
                <p className="text-center text-xs text-gray-600">
                  Velg en skjermkilde for å begynne
                </p>
              )}

              {stage === 'preview' && (
                <button
                  onClick={startRecording}
                  className="w-full flex items-center justify-center gap-2.5 h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-red-900/30"
                >
                  <Circle className="w-3.5 h-3.5 fill-white" />
                  Start opptak
                </button>
              )}

              {stage === 'recording' && (
                <button
                  onClick={() => { stopRecording(); setRecordModalOpen(false) }}
                  className="w-full flex items-center justify-center gap-2.5 h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-red-900/30"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  Stopp opptak
                </button>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Global save dialog ─────────────────────────────────────────────── */}
      {stage === 'saving' && blob && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 pt-6 pb-5 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Opptak fullført</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {fmtTime(timerValRef.current)} · {fmtBytes(blob.size)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Navn på opptak
                </label>
                <input
                  autoFocus
                  type="text"
                  value={recTitle}
                  onChange={e => setRecTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveRecording() }}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {upErr && (
                <div className="flex items-start gap-2 bg-red-50 px-3 py-2.5 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{upErr}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={downloadBlob}
                  className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Last ned
                </button>
                <button
                  onClick={saveRecording}
                  disabled={upLoading}
                  className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {upLoading ? 'Laster opp...' : 'Lagre'}
                </button>
              </div>

              <button
                onClick={discardRecording}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Forkast opptak
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
