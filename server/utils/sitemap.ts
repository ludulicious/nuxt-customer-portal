import { documentationCatalog } from './documentation-catalog'
import { absoluteSiteUrl } from './site'

export const sitemapRoutes = [
  '/',
  ...documentationCatalog.map(page => page.path),
  '/privacy-policy',
  '/terms-of-service'
]

export function renderSitemap() {
  const entries = sitemapRoutes
    .map(path => `  <url><loc>${absoluteSiteUrl(path)}</loc></url>`)
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</urlset>'
  ].join('\n')
}
