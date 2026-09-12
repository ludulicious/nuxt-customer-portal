export default defineEventHandler(async () => {
  const { settings, completed } = await readPortalSettings()
  return {
    completed,
    languages: settings.languages,
    clients: settings.clients,
    branding: settings.branding,
    appearance: settings.appearance,
    enabledModules: settings.enabledModules,
    content: settings.content
  }
})
