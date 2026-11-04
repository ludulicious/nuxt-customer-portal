import { logPortalServerError } from '../utils/server-error-logging'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    logPortalServerError(error, event)
  })
})
