// MediaRecorder's fragmented-MP4 output (Chrome 126+) writes a moov box up
// front, but leaves its mvhd/tkhd/mdhd duration fields at 0 — a documented
// gap in the same spirit as WebM's missing duration (see
// fix-webm-duration), just inside a different container. Left unpatched,
// players can't reliably seek to — or in some players even play through
// to — the actual end of the file. This overwrites those three duration
// fields in place with the real recorded duration.
//
// Every field patched already exists at a fixed byte width (this is
// standard ISO/IEC 14496-12 box layout), so nothing is inserted or
// removed: the file size and every other box's offsets stay exactly where
// they were. If the expected box structure isn't found — a version/format
// quirk this doesn't recognize — nothing is written and the original blob
// comes back unchanged, so a parsing miss can never corrupt the file.

interface BoxHeader {
  type: string
  bodyOffset: number
  end: number
}

function readBoxHeader(view: DataView, offset: number, limit: number): BoxHeader | null {
  if (offset + 8 > limit) return null
  let size = view.getUint32(offset)
  const type = String.fromCharCode(
    view.getUint8(offset + 4), view.getUint8(offset + 5),
    view.getUint8(offset + 6), view.getUint8(offset + 7),
  )
  let bodyOffset = offset + 8
  if (size === 1) {
    if (offset + 16 > limit) return null
    const big = view.getBigUint64(offset + 8)
    if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null
    size = Number(big)
    bodyOffset = offset + 16
  } else if (size === 0) {
    size = limit - offset
  }
  if (size < 8 || offset + size > limit) return null
  return { type, bodyOffset, end: offset + size }
}

function findBox(view: DataView, start: number, limit: number, type: string): BoxHeader | null {
  let offset = start
  while (offset < limit) {
    const box = readBoxHeader(view, offset, limit)
    if (!box) return null
    if (box.type === type) return box
    offset = box.end
  }
  return null
}

function findAllBoxes(view: DataView, start: number, limit: number, type: string): BoxHeader[] {
  const found: BoxHeader[] = []
  let offset = start
  while (offset < limit) {
    const box = readBoxHeader(view, offset, limit)
    if (!box) break
    if (box.type === type) found.push(box)
    offset = box.end
  }
  return found
}

// mvhd/tkhd/mdhd are all FullBoxes (1-byte version + 3-byte flags) whose
// body layout only differs in whether the time fields are 32-bit (v0) or
// 64-bit (v1) — the duration field sits at a fixed offset either way.
function patchFullBoxDuration(
  view: DataView, box: BoxHeader, durationUnits: number,
  v0DurationOffset: number, v1DurationOffset: number,
): boolean {
  const version = view.getUint8(box.bodyOffset)
  const bodyLen = box.end - box.bodyOffset
  if (version === 0) {
    if (bodyLen < v0DurationOffset + 4) return false
    view.setUint32(box.bodyOffset + v0DurationOffset, Math.round(durationUnits) >>> 0)
    return true
  }
  if (version === 1) {
    if (bodyLen < v1DurationOffset + 8) return false
    view.setBigUint64(box.bodyOffset + v1DurationOffset, BigInt(Math.round(durationUnits)))
    return true
  }
  return false
}

function readTimescale(view: DataView, box: BoxHeader, v0Offset: number, v1Offset: number): number | null {
  const version = view.getUint8(box.bodyOffset)
  const bodyLen = box.end - box.bodyOffset
  if (version === 0) {
    if (bodyLen < v0Offset + 4) return null
    return view.getUint32(box.bodyOffset + v0Offset)
  }
  if (version === 1) {
    if (bodyLen < v1Offset + 4) return null
    return view.getUint32(box.bodyOffset + v1Offset)
  }
  return null
}

export async function fixMp4Duration(blob: Blob, durationMs: number): Promise<Blob> {
  try {
    const buf = await blob.arrayBuffer()
    const view = new DataView(buf)
    const limit = buf.byteLength
    const durationSec = durationMs / 1000

    const moov = findBox(view, 0, limit, 'moov')
    if (!moov) return blob

    const mvhd = findBox(view, moov.bodyOffset, moov.end, 'mvhd')
    if (!mvhd) return blob
    // mvhd body: version(1)+flags(3), then v0: creation(4)+modification(4)
    // +timescale(4)+duration(4); v1: creation(8)+modification(8)+timescale(4)+duration(8)
    const mvhdTimescale = readTimescale(view, mvhd, 12, 20)
    if (!mvhdTimescale) return blob
    const movieDuration = durationSec * mvhdTimescale
    if (!patchFullBoxDuration(view, mvhd, movieDuration, 16, 24)) return blob

    // tkhd's own duration is expressed in the *movie's* timescale, not the
    // track's — per spec, so it reuses movieDuration, not mdhdTimescale.
    const traks = findAllBoxes(view, moov.bodyOffset, moov.end, 'trak')
    for (const trak of traks) {
      const tkhd = findBox(view, trak.bodyOffset, trak.end, 'tkhd')
      if (tkhd) patchFullBoxDuration(view, tkhd, movieDuration, 20, 28)

      const mdia = findBox(view, trak.bodyOffset, trak.end, 'mdia')
      if (!mdia) continue
      const mdhd = findBox(view, mdia.bodyOffset, mdia.end, 'mdhd')
      if (!mdhd) continue
      const mdhdTimescale = readTimescale(view, mdhd, 12, 20)
      if (!mdhdTimescale) continue
      patchFullBoxDuration(view, mdhd, durationSec * mdhdTimescale, 16, 24)
    }

    return new Blob([buf], { type: blob.type })
  } catch {
    return blob
  }
}
