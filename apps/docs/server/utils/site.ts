export const siteUrl = 'https://nuxt-customer-portal.com'

export function absoluteSiteUrl(path: string) {
  return `${siteUrl}${path === '/' ? '' : path}`
}
