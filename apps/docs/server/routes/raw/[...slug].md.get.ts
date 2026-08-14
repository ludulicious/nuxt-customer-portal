import { queryCollection } from '@nuxt/content/server'
import { createError, defineEventHandler, getRouterParams, setHeader } from 'h3'
import { withLeadingSlash } from 'ufo'

export default defineEventHandler(async (event) => {
  const slug = getRouterParams(event)['slug.md']
  if (!slug?.endsWith('.md')) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  const path = withLeadingSlash(slug.slice(0, -3)).replace(/\/index$/, '') || '/'
  const page = await queryCollection(event, 'docs')
    .path(path)
    .select('rawbody')
    .first()

  if (!page?.rawbody) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  return page.rawbody
})
