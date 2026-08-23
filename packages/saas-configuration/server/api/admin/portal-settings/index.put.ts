export default defineEventHandler(async (event) => {
  await requirePortalSettingsAdmin(event)
  const body = await readBody(event)
  return writePortalSettings(body?.settings, body?.step)
})
