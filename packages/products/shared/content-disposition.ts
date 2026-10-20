/** Supply a quoted fallback as well as the RFC 8187 name for browser compatibility. */
export function assetContentDisposition(fileName: string, download: boolean) {
  const safeName = fileName.replace(/[\p{Cc}/\\]/gu, '_')
  const fallback = safeName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(safeName).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `${download ? 'attachment' : 'inline'}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}
