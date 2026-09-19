export default defineEventHandler(async (event) => {
  const session = await requirePortalSettingsAdmin(event)
  const body = await readBody(event)
  return writePortalSettings(body?.settings, body?.step, session.user.id)
})
