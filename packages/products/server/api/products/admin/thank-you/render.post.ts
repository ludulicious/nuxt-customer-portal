import { z } from 'zod'
import { admin } from '../../../../utils/access'
import { parseInput } from '../../../../utils/validation'
import { renderDescription } from '../../../../utils/markdown'

export default defineEventHandler(async (event) => {
  await admin(event)
  const { content } = parseInput(z.object({ content: z.string().max(12000) }).strict(), await readBody(event))
  setHeader(event, 'Cache-Control', 'private, no-store')
  return { html: renderDescription(content) }
})
