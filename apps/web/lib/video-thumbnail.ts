// Coaches almost always paste a YouTube link on an exercise — derive a real
// video-frame thumbnail from it wherever one isn't stored yet, so exercises
// show an actual picture instead of a generic dumbbell/video icon.
export function youTubeThumbnail(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null
}

// Stored thumbnail_url wins (e.g. a curated standard-exercise image); otherwise
// fall back to a frame derived from the video link at display time.
export function exerciseThumbnail(ex: { thumbnail_url?: string | null; video_url?: string | null }): string | null {
  return ex.thumbnail_url ?? youTubeThumbnail(ex.video_url)
}
