import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { documentationCatalog } from '../../server/utils/documentation-catalog'
import { sitemapRoutes, renderSitemap } from '../../server/utils/sitemap'
import { documentationDefaults } from '../../shared/documentation'

const root = resolve(import.meta.dirname, '../..')
const contentRoot = join(root, 'content')
const documentedSections = [
  '1.getting-started',
  '2.architecture',
  '3.modules',
  '4.reference',
  '5.operations',
  '6.guides',
  '7.contributing'
]

function markdownFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory()
      ? markdownFiles(path)
      : path.endsWith('.md') ? [path] : []
  })
}

function publicRoute(file: string): string {
  const segments = relative(contentRoot, file)
    .split(sep)
    .map(segment => segment.replace(/^\d+\./, '').replace(/\.md$/, ''))

  if (segments.at(-1) === 'index') {
    segments.pop()
  }

  return `/${segments.join('/')}`.replace(/\/$/, '') || '/'
}

function frontmatterValue(source: string, key: string): string | undefined {
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1]
  return frontmatter
    ?.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]
    ?.replace(/^['"]|['"]$/g, '')
}

function envExampleValue(key: string): string | undefined {
  const source = readFileSync(join(root, '.env.example'), 'utf8')
  return source.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]
}

describe('documentation content', () => {
  const allFiles = markdownFiles(contentRoot)
  const activeFiles = documentedSections.flatMap(section => markdownFiles(join(contentRoot, section)))
  const routes = new Set(allFiles.map(publicRoute))

  it('has unique public routes', () => {
    expect(routes.size).toBe(allFiles.length)
  })

  it('has contributor-facing metadata tied to a real source file', () => {
    const failures = activeFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      const sourcePath = relative(root, file).split(sep).join('/')
      const problems: string[] = []

      if (!frontmatterValue(source, 'title')) problems.push('missing title')
      if (!frontmatterValue(source, 'description')) problems.push('missing description')
      if (frontmatterValue(source, 'githubPath') !== sourcePath) problems.push('githubPath does not match source')
      if (!existsSync(join(root, sourcePath))) problems.push('githubPath does not exist')

      return problems.map(problem => `${sourcePath}: ${problem}`)
    })

    expect(failures, failures.join('\n')).toEqual([])
  })

  it('does not link to missing internal documentation routes', () => {
    const failures = activeFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '')
      const links = [
        ...source.matchAll(/\]\((\/[^)\s]+)\)/g),
        ...source.matchAll(/^\s*to:\s*(\/\S+)\s*$/gm)
      ].map(match => match[1])

      return links.flatMap((link) => {
        const route = link?.split(/[?#]/)[0]?.replace(/\/$/, '') || '/'
        return route.startsWith('/raw') || routes.has(route)
          ? []
          : [`${relative(root, file)} -> ${link}`]
      })
    })

    expect(failures, failures.join('\n')).toEqual([])
  })

  it('keeps the MCP catalog aligned with maintained documentation', () => {
    const expected = activeFiles.map((file) => {
      const source = readFileSync(file, 'utf8')
      return {
        path: publicRoute(file),
        title: frontmatterValue(source, 'title'),
        description: frontmatterValue(source, 'description')
      }
    }).sort((left, right) => left.path.localeCompare(right.path))
    const actual = [...documentationCatalog].sort((left, right) => left.path.localeCompare(right.path))

    expect(actual).toEqual(expected)
  })

  it('publishes every maintained page in a valid sitemap', () => {
    const expectedRoutes = [
      '/',
      ...documentationCatalog.map(page => page.path),
      '/privacy-policy',
      '/terms-of-service'
    ]
    const sitemap = renderSitemap()

    expect(sitemapRoutes).toEqual(expectedRoutes)
    expect(new Set(sitemapRoutes).size).toBe(sitemapRoutes.length)
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expectedRoutes.forEach((route) => {
      const url = `https://portalnuxt.com${route === '/' ? '' : route}`
      expect(sitemap).toContain(`<loc>${url}</loc>`)
    })
  })

  it('pins contributor links to valid repositories and an immutable product revision', () => {
    expect(new URL(documentationDefaults.docsRepositoryUrl).hostname).toBe('github.com')
    expect(new URL(documentationDefaults.feedbackRepositoryUrl).hostname).toBe('github.com')
    expect(new URL(documentationDefaults.productRepositoryUrl).hostname).toBe('github.com')
    expect(documentationDefaults.docsRepositoryBranch).toMatch(/^[\w./-]+$/)
    expect(documentationDefaults.productSourceCommit).toMatch(/^[a-f0-9]{40}$/)
    expect(envExampleValue('NUXT_PUBLIC_DOCS_REPOSITORY_URL')).toBe(documentationDefaults.docsRepositoryUrl)
    expect(envExampleValue('NUXT_PUBLIC_DOCS_REPOSITORY_BRANCH')).toBe(documentationDefaults.docsRepositoryBranch)
    expect(envExampleValue('NUXT_PUBLIC_DOCS_FEEDBACK_REPOSITORY_URL')).toBe(documentationDefaults.feedbackRepositoryUrl)
    expect(envExampleValue('NUXT_PUBLIC_PRODUCT_REPOSITORY_URL')).toBe(documentationDefaults.productRepositoryUrl)
    expect(envExampleValue('NUXT_PUBLIC_PRODUCT_SOURCE_COMMIT')).toBe(documentationDefaults.productSourceCommit)
  })

  it('documents the verified GitHub collaboration channels', () => {
    const collaboration = JSON.parse(readFileSync(join(root, 'shared/github-collaboration.json'), 'utf8')) as {
      documentationPath: string
      repositories: Record<string, {
        url: string
        public: boolean
        defaultBranch: string
        issues: boolean
        discussions: boolean
        template: boolean
        archived: boolean
      }>
    }
    const community = readFileSync(join(contentRoot, '7.contributing/7.community.md'), 'utf8')
    const installation = readFileSync(join(contentRoot, '1.getting-started/2.installation.md'), 'utf8')

    expect(routes.has(collaboration.documentationPath)).toBe(true)
    expect(collaboration.repositories.product.url).toBe(documentationDefaults.productRepositoryUrl)
    expect(collaboration.repositories.documentation.url).toBe(documentationDefaults.docsRepositoryUrl)
    expect(collaboration.repositories.product).toMatchObject({
      public: true,
      defaultBranch: 'master',
      issues: true,
      discussions: false,
      template: true,
      archived: false
    })
    expect(collaboration.repositories.documentation).toMatchObject({
      public: true,
      defaultBranch: 'master',
      issues: true,
      discussions: false,
      template: false,
      archived: false
    })
    expect(community).toContain('GitHub Discussions are not currently enabled')
    expect(community).toContain('customer-portal/issues/new?template=bug-report.yml')
    expect(community).toContain('customer-portal/issues/new?template=question.yml')
    expect(community).toContain('customer-portal/issues/new?template=feature-request.yml')
    expect(community).toContain('customer-portal/issues/new?template=module-proposal.yml')
    expect(community).toContain('customer-portal/blob/master/CONTRIBUTING.md')
    expect(community).toContain('customer-portal/blob/master/SUPPORT.md')
    expect(community).toContain('customer-portal/blob/master/SECURITY.md')
    expect(installation).toContain('configured as a GitHub template')
  })

  it('maps documented product internals to immutable source links', () => {
    const sourceMap = readFileSync(join(contentRoot, '4.reference/7.source-map.md'), 'utf8')
    const sourcePrefix = `${documentationDefaults.productRepositoryUrl}/blob/`
    const sourceLinks = [...sourceMap.matchAll(/\]\((https:\/\/github\.com\/ludulicious\/customer-portal\/blob\/([a-f0-9]{40})\/([^)]+))\)/g)]

    expect(sourceLinks.length).toBeGreaterThanOrEqual(30)
    sourceLinks.forEach(([, url, revision, path]) => {
      expect(url.startsWith(sourcePrefix)).toBe(true)
      expect(revision).toBe(documentationDefaults.productSourceCommit)
      expect(path).not.toContain('..')
      expect(path).not.toContain('#')
    })
    expect(new Set(sourceLinks.map(match => match[3])).size).toBe(sourceLinks.length)
    expect(sourceMap).toContain('[glossary](/reference/glossary)')
  })

  it('defines contributor terminology and connects it to implementation references', () => {
    const glossary = readFileSync(join(contentRoot, '4.reference/6.glossary.md'), 'utf8')

    expect(glossary).toContain('### Feature layer')
    expect(glossary).toContain('### Module')
    expect(glossary).toContain('### Active organization')
    expect(glossary).toContain('### Capability')
    expect(glossary).toContain('### Source layer')
    expect(glossary).toContain('[source map](/reference/source-map)')
  })

  it('documents every layer shipped by the pinned product inventory', () => {
    const inventory = JSON.parse(readFileSync(join(root, 'shared/product-inventory.json'), 'utf8')) as {
      license: { status: string, spdxId: string | null, documentationPath: string }
      layers: Array<{
        id: string
        kind: string
        documentationPath: string
        pageCount: number
        apiHandlerCount: number
        apiFamilies: string[]
      }>
    }
    const routeFiles = new Map(activeFiles.map(file => [publicRoute(file), file]))
    const layerIds = inventory.layers.map(layer => layer.id)

    expect(new Set(layerIds).size).toBe(layerIds.length)
    expect(new Set(inventory.layers.map(layer => layer.kind))).toEqual(new Set(['foundation', 'platform', 'business']))

    inventory.layers.forEach((layer) => {
      const documentationFile = routeFiles.get(layer.documentationPath)
      expect(documentationFile, `${layer.id} has no maintained documentation route`).toBeTruthy()
      expect(readFileSync(documentationFile!, 'utf8')).toContain(`\`${layer.id}\``)
      expect(layer.pageCount).toBeGreaterThan(0)
      expect(layer.apiHandlerCount).toBeGreaterThanOrEqual(0)
      layer.apiFamilies.forEach(family => expect(family).toMatch(/^\/api\//))
    })

    const apiReference = readFileSync(join(contentRoot, '4.reference/4.server-api.md'), 'utf8')
    const totalHandlers = inventory.layers.reduce((total, layer) => total + layer.apiHandlerCount, 0)
    expect(apiReference).toContain(`contains ${totalHandlers} Nitro API handler files`)
    expect(inventory.license.status).toBe('pending')
    expect(inventory.license.spdxId).toBeNull()
    expect(routes.has(inventory.license.documentationPath)).toBe(true)

    const homepage = readFileSync(join(root, 'app/pages/index.vue'), 'utf8')
    const terms = readFileSync(join(contentRoot, 'terms-of-service.md'), 'utf8')
    const privacy = readFileSync(join(contentRoot, 'privacy-policy.md'), 'utf8')
    expect(homepage).toContain('An explicit open-source license is pending')
    expect(homepage).not.toContain('an extensible open-source portal')
    expect(terms).not.toContain('provided under its open source license')
    expect(terms).toContain('does not contain an explicit software license')
    expect(privacy).not.toContain('The Project is open source')
  })

  it('documents the complete direct, library-owned, and runtime environment contract', () => {
    const environment = JSON.parse(readFileSync(join(root, 'shared/product-environment.json'), 'utf8')) as {
      documentationPath: string
      directVariables: string[]
      libraryVariables: string[]
      runtimeVariables: string[]
      exampleExclusions: string[]
      knownExampleOmissions: string[]
    }
    const configuration = readFileSync(join(contentRoot, '4.reference/2.configuration.md'), 'utf8')
    const installation = readFileSync(join(contentRoot, '1.getting-started/2.installation.md'), 'utf8')
    const variables = [...environment.directVariables, ...environment.libraryVariables, ...environment.runtimeVariables]

    expect(new Set(variables).size).toBe(variables.length)
    expect(routes.has(environment.documentationPath)).toBe(true)
    variables.forEach(variable => expect(configuration).toContain(`\`${variable}\``))
    expect(environment.libraryVariables).toEqual(['BETTER_AUTH_SECRET'])
    expect(environment.knownExampleOmissions).toEqual(['BETTER_AUTH_SECRET'])
    expect(environment.exampleExclusions).toEqual(['NODE_ENV'])
    expect(configuration).toContain('Better Auth secret reference')
    expect(installation).toContain('openssl rand -base64 32')
    expect(installation).toContain('BETTER_AUTH_SECRET=<paste-the-generated-secret>')
  })

  it('keeps the external layer path explicit and source-backed', () => {
    const creationGuide = readFileSync(join(contentRoot, '7.contributing/2.create-a-layer.md'), 'utf8')
    const distributionGuide = readFileSync(join(contentRoot, '7.contributing/3.distribute-a-layer.md'), 'utf8')

    expect(creationGuide).toContain('PortalFeatureDefinition<NoteAction>')
    expect(creationGuide).toContain('requireFeatureAccess')
    expect(creationGuide).toContain('pgSchema(\'notes\')')
    expect(creationGuide).toContain('area: \'aside\'')
    expect(creationGuide).toContain('size: \'full\'')
    expect(distributionGuide).toContain('does not yet publish a versioned layer SDK')
    expect(distributionGuide).toContain('Customer Portal revision')
    expect(distributionGuide).toContain('cross-organization requests are rejected')
  })
})
