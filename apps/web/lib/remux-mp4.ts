// Chrome's MediaRecorder always produces fragmented MP4 (a moov with an
// mvex box, followed by a moof/mdat pair per chunk instead of one flat
// mdat) — confirmed by inspecting real recordings, which had 70+ moof
// fragments each. Desktop tools (ffmpeg, browsers) parse this fine, but
// iOS's AVPlayer can apparently decode the audio track from the fragments
// while failing to render video from them at all — a client sees a black
// screen with sound. Losslessly transmuxing to a flat MP4 (single moov
// with full sample tables, written up front) right after recording, before
// it's ever uploaded, fixes this everywhere it's later played.
//
// Loaded dynamically (not a top-level import) since this only runs once,
// when a recording finishes — no reason to ship it in the main bundle for
// every coach who never records.
export async function remuxToFlatMp4(blob: Blob): Promise<Blob> {
  const { Input, Output, Conversion, ALL_FORMATS, BlobSource, Mp4OutputFormat, BufferTarget } =
    await import('mediabunny')

  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) })
  const output = new Output({
    // 'in-memory': writes the moov box up front (faststart) instead of
    // appending it at the end or fragmenting — the flat structure that
    // fixes iOS playback. Recordings are held in memory until finalized,
    // which is fine at the sizes these run (screen-recording clips, not
    // hours of 4K footage).
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  })

  const conversion = await Conversion.init({ input, output })
  if (!conversion.isValid) {
    throw new Error(
      `Mediabunny conversion invalid: ${conversion.discardedTracks.map(t => t.reason).join(', ') || 'unknown reason'}`
    )
  }

  // Video/audio packets are copied across as-is, not decoded and
  // re-encoded — H.264/AAC are natively supported by MP4 output and none
  // of the conditions that force a re-encode (resize, crop, codec change,
  // quality/bitrate override) apply here, so this only restructures the
  // container. Verified against Mediabunny's own source: that fast path is
  // what runs whenever the source codec is already valid for the output
  // format and no transform is requested.
  await conversion.execute()

  const buffer = output.target.buffer
  if (!buffer) throw new Error('Mediabunny produced no output buffer')
  return new Blob([buffer], { type: 'video/mp4' })
}
