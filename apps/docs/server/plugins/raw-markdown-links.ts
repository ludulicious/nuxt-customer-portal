export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('llms:generate', (_event, options) => {
    for (const section of options.sections) {
      if (section.contentCollection !== 'docs') continue

      section.links = section.links?.map((link) => {
        const url = new URL(link.href)
        if (!url.pathname.startsWith('/raw/')) {
          url.pathname = `/raw${url.pathname.replace(/\/$/, '')}.md`
        }

        return { ...link, href: url.toString() }
      })
    }
  })
})
