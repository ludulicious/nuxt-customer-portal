export default defineEventHandler(async (event) => {
  await requirePortalSettingsAdmin(event)
  return readPortalSettings()
})
