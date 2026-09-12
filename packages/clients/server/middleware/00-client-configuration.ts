import { requireClientConfigurationReady } from '../utils/client-configuration'

export default defineEventHandler(async () => {
  await requireClientConfigurationReady()
})
