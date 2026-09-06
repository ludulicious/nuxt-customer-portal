import { isPortalDemo } from '@nuxt-customer-portal/core/server/utils/demo'
import { ensureDemoSession } from '../utils/demo-session'

export default defineEventHandler(async (event) => {
  if (isPortalDemo() && event.path.startsWith('/api/')) {
    await ensureDemoSession(event)
  }
})
