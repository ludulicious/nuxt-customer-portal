import { closeSaasPools } from '../utils/tenant-runtime'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', closeSaasPools)
})
