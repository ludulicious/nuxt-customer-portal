export default defineEventHandler(async (event) => {
  await requirePortalSettingsAdmin(event)
  const body = await readBody(event)
  return completePortalOnboarding(body?.settings)
})
