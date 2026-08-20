import { closeSaasPools } from '../utils/workspace-runtime'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', closeSaasPools)
})
