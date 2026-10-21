export type PurchaseMedia = { kind: 'embed' | 'audio' | 'video'; url: string }

// Only recognized providers become frames; arbitrary web pages remain ordinary links.
export function purchaseMedia(value: string): PurchaseMedia | undefined {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    return undefined
  }
  const host = url.hostname.toLowerCase()
  if (
    [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtube-nocookie.com',
      'www.youtube-nocookie.com',
      'youtu.be'
    ].includes(host)
  ) {
    const id =
      host === 'youtu.be'
        ? url.pathname.slice(1)
        : url.pathname === '/watch'
          ? url.searchParams.get('v')
          : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1]
    if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) {
      return undefined
    }
    const player = new URL(`https://www.youtube-nocookie.com/embed/${id}`)
    const start = url.searchParams.get('start') || url.searchParams.get('t')
    if (start && /^\d+$/.test(start)) {
      player.searchParams.set('start', start)
    }
    return { kind: 'embed', url: player.href }
  }
  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    const match = url.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/)
    if (!match) {
      return undefined
    }
    const player = new URL(`https://player.vimeo.com/video/${match[1]}`)
    const hash = url.searchParams.get('h') || match[2]
    if (hash && /^[a-zA-Z0-9]+$/.test(hash)) {
      player.searchParams.set('h', hash)
    }
    return { kind: 'embed', url: player.href }
  }
  if (/\.(mp4|webm)$/i.test(url.pathname)) {
    return { kind: 'video', url: url.href }
  }
  if (/\.(mp3|m4a|wav|ogg)$/i.test(url.pathname)) {
    return { kind: 'audio', url: url.href }
  }
  return undefined
}

export const publicOrderPath = (token: string) => `/store/orders/${encodeURIComponent(token)}`
