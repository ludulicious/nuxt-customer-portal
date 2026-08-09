import type { MaybeRefOrGetter } from 'vue'

interface DocumentationLinkOptions {
  githubPath: MaybeRefOrGetter<string | undefined>
  title: MaybeRefOrGetter<string | undefined>
}

export function useDocumentationLinks(options: DocumentationLinkOptions) {
  const route = useRoute()
  const site = useSiteConfig()
  const config = useRuntimeConfig()

  const siteUrl = computed(() => (site.url || 'https://portalnuxt.com').replace(/\/$/, ''))
  const pageUrl = computed(() => `${siteUrl.value}${route.path}`)
  const markdownPath = computed(() => `${siteUrl.value}/raw${route.path}.md`)
  const editPageUrl = computed(() => {
    const githubPath = toValue(options.githubPath)
    if (!githubPath) return undefined

    return `${config.public.docsRepositoryUrl}/edit/${config.public.docsRepositoryBranch}/${githubPath}`
  })
  const sourceRevisionUrl = computed(() => (
    `${config.public.productRepositoryUrl}/commit/${config.public.productSourceCommit}`
  ))
  const sourceRevisionLabel = computed(() => config.public.productSourceCommit.slice(0, 7))
  const reportPageUrl = computed(() => {
    const title = toValue(options.title) || route.path
    const body = [
      '## Documentation page',
      pageUrl.value,
      '',
      '## Verified Customer Portal source',
      sourceRevisionUrl.value,
      '',
      '## What needs improvement?',
      '<!-- Explain what is unclear, incomplete, outdated, or incorrect. -->',
      '',
      '## Suggested change',
      '<!-- Optional: describe the result you expected or suggest replacement wording. -->'
    ].join('\n')
    const params = new URLSearchParams({
      title: `Docs: ${title}`,
      body
    })

    return `${config.public.docsFeedbackRepositoryUrl}/issues/new?${params.toString()}`
  })

  return {
    editPageUrl,
    markdownPath,
    pageUrl,
    reportPageUrl,
    sourceRevisionLabel,
    sourceRevisionUrl
  }
}
