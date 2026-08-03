import { timesheetsFeature } from '#layers/timesheets/shared/feature'

export default defineNuxtPlugin(() => {
  usePortalFeatures().registerFeature(timesheetsFeature)
})
