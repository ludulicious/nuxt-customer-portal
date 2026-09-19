export default defineEventHandler(async (event) => {
  const session = await requirePortalSettingsAdmin(event)
  const body = await readBody(event)
  return completePortalOnboarding(body?.settings, session.user.id)
})
