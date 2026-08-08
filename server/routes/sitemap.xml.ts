import { renderSitemap } from '../utils/sitemap'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return renderSitemap()
})
