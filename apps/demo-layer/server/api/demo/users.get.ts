import { isPortalDemo } from '@nuxt-customer-portal/core/server/utils/demo'
import { demoIdentities } from '../../utils/identities'

export default defineEventHandler(() => {
  if (!isPortalDemo()) {
    throw createError({ statusCode: 404 })
  }
  return demoIdentities.map((person) => ({ ...person, image: `/demo/avatars/${person.id}.svg` }))
})
