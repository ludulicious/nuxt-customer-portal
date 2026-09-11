export default defineNuxtPlugin({
  name: 'portal-languages',
  dependsOn: ['i18n:plugin'],
  setup(app) {
    const { settings } = usePortalSettings()
    watch(
      [() => settings.value?.languages, () => app.$i18n.locale.value],
      ([languages, locale]) => {
        if (languages?.length && !languages.includes(locale as 'en' | 'nl')) {
          void app.$i18n.setLocale(languages[0]!)
        }
      },
      { immediate: true }
    )
  }
})
