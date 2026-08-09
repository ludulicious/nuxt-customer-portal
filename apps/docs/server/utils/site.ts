export const siteUrl = 'https://portalnuxt.com'

export function absoluteSiteUrl(path: string) {
  return `${siteUrl}${path === '/' ? '' : path}`
}
