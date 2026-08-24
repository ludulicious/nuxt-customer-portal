import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'

const source = await readFile(new URL('../.env.example', import.meta.url), 'utf8')
const productInventory = JSON.parse(
  await readFile(new URL('../shared/product-inventory.json', import.meta.url), 'utf8')
)
const productEnvironment = JSON.parse(
  await readFile(new URL('../shared/product-environment.json', import.meta.url), 'utf8')
)
const githubCollaboration = JSON.parse(
  await readFile(new URL('../shared/github-collaboration.json', import.meta.url), 'utf8')
)
const configuration = Object.fromEntries(
  source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=')
      return [line.slice(0, separator), line.slice(separator + 1)]
    })
)

const docsRepository = configuration.NUXT_PUBLIC_DOCS_REPOSITORY_URL
const docsBranch = configuration.NUXT_PUBLIC_DOCS_REPOSITORY_BRANCH
const feedbackRepository = configuration.NUXT_PUBLIC_DOCS_FEEDBACK_REPOSITORY_URL
const productRepository = configuration.NUXT_PUBLIC_PRODUCT_REPOSITORY_URL
const productCommit = configuration.NUXT_PUBLIC_PRODUCT_SOURCE_COMMIT
const githubHeaders = {
  accept: 'application/vnd.github+json',
  'user-agent': 'nuxt-customer-portal-public-link-check',
  ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
}

const checks = [
  ['documentation repository', docsRepository],
  ['documentation branch', `${docsRepository}/tree/${docsBranch}`],
  ['feedback repository', feedbackRepository],
  ['verified product source', `${productRepository}/commit/${productCommit}`]
]

for (const [label, url] of checks) {
  if (!url) {
    throw new Error(`Missing URL for ${label}`)
  }
  const response = await fetch(url, {
    headers: { 'user-agent': 'nuxt-customer-portal-public-link-check' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000)
  })
  if (!response.ok) {
    throw new Error(`${label} is not publicly reachable: ${url} (${response.status})`)
  }
  console.log(`✓ ${label}: ${url}`)
}

for (const [role, expected] of Object.entries(githubCollaboration.repositories)) {
  const repositoryPath = new URL(expected.url).pathname.replace(/^\//, '')
  const metadataUrl = `https://api.github.com/repos/${repositoryPath}`
  const response = await fetch(metadataUrl, {
    headers: githubHeaders,
    signal: AbortSignal.timeout(15_000)
  })

  if (!response.ok) {
    throw new Error(`Could not verify ${role} repository collaboration settings: ${metadataUrl} (${response.status})`)
  }

  const actual = await response.json()
  const actualSettings = {
    url: actual.html_url,
    public: !actual.private,
    defaultBranch: actual.default_branch,
    issues: actual.has_issues,
    discussions: actual.has_discussions,
    template: actual.is_template,
    archived: actual.archived
  }

  const differences = Object.entries(expected)
    .filter(([key, value]) => actualSettings[key] !== value)
    .map(([key, value]) => `${key}: expected ${JSON.stringify(value)}, received ${JSON.stringify(actualSettings[key])}`)

  if (differences.length) {
    throw new Error(`${role} repository collaboration settings have changed:\n${differences.join('\n')}`)
  }

  console.log(
    `✓ ${role} collaboration: public=${actualSettings.public}, issues=${actualSettings.issues}, discussions=${actualSettings.discussions}, template=${actualSettings.template}`
  )
}

const sourceMap = await readFile(new URL('../content/4.reference/7.source-map.md', import.meta.url), 'utf8')
const escapedRepository = productRepository.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const sourceLinkPattern = new RegExp(`${escapedRepository}/blob/${productCommit}/([^)]+)`, 'g')
const documentedSourcePaths = [...sourceMap.matchAll(sourceLinkPattern)].map((match) => match[1])

if (!documentedSourcePaths.length) {
  throw new Error('Product source map does not contain pinned source links')
}

const repositoryPath = new URL(productRepository).pathname.replace(/^\//, '')
const treeUrl = `https://api.github.com/repos/${repositoryPath}/git/trees/${productCommit}?recursive=1`
const treeResponse = await fetch(treeUrl, {
  headers: githubHeaders,
  signal: AbortSignal.timeout(15_000)
})

if (!treeResponse.ok) {
  throw new Error(`Could not inspect the public product tree: ${treeUrl} (${treeResponse.status})`)
}

const tree = await treeResponse.json()
if (tree.truncated) {
  throw new Error('GitHub returned a truncated product tree; source-map integrity cannot be proven')
}

const repositoryFiles = new Set(tree.tree.filter((entry) => entry.type === 'blob').map((entry) => entry.path))
const missingSourcePaths = documentedSourcePaths.filter((path) => !repositoryFiles.has(path))
if (missingSourcePaths.length) {
  throw new Error(`Product source map references missing files:\n${missingSourcePaths.join('\n')}`)
}

console.log(`✓ product source map: ${documentedSourcePaths.length} pinned files`)

const repositoryLayers = [...repositoryFiles]
  .map((path) => path.match(/^packages\/([^/]+)\/package\.json$/)?.[1])
  .filter(Boolean)
  .sort()
const documentedLayers = productInventory.layers.map((layer) => layer.id).sort()

if (JSON.stringify(repositoryLayers) !== JSON.stringify(documentedLayers)) {
  throw new Error(
    [
      'Documented public package inventory does not match the pinned repository tree.',
      `Repository: ${repositoryLayers.join(', ')}`,
      `Documented: ${documentedLayers.join(', ')}`
    ].join('\n')
  )
}

console.log(`✓ product package inventory: ${documentedLayers.length} documented packages`)

for (const layer of productInventory.layers) {
  const pagePrefix = `packages/${layer.id}/app/pages/`
  const apiPrefix = `packages/${layer.id}/server/api/`
  const pageCount = [...repositoryFiles].filter((path) => path.startsWith(pagePrefix) && path.endsWith('.vue')).length
  const apiHandlerCount = [...repositoryFiles].filter(
    (path) => path.startsWith(apiPrefix) && path.endsWith('.ts')
  ).length

  if (pageCount !== layer.pageCount || apiHandlerCount !== layer.apiHandlerCount) {
    throw new Error(
      [
        `Product surface inventory is stale for ${layer.id}.`,
        `Repository: ${pageCount} pages, ${apiHandlerCount} API handlers`,
        `Documented: ${layer.pageCount} pages, ${layer.apiHandlerCount} API handlers`
      ].join('\n')
    )
  }
}

const totalPages = productInventory.layers.reduce((total, layer) => total + layer.pageCount, 0)
const totalApiHandlers = productInventory.layers.reduce((total, layer) => total + layer.apiHandlerCount, 0)
console.log(`✓ product surface inventory: ${totalPages} pages and ${totalApiHandlers} API handlers`)

const productLicenseFiles = [...repositoryFiles].filter((path) => /^(licen[cs]e|copying)(\.[a-z0-9]+)?$/i.test(path))
if (!['pending', 'licensed'].includes(productInventory.license.status)) {
  throw new Error(`Unsupported product license status: ${productInventory.license.status}`)
}
if (productInventory.license.status === 'pending' && productLicenseFiles.length) {
  throw new Error(`Product licensing status is stale; found ${productLicenseFiles.join(', ')}`)
}
if (productInventory.license.status === 'licensed' && !productLicenseFiles.length) {
  throw new Error('Product is documented as licensed but no root license file exists')
}
if (productInventory.license.status === 'licensed' && productInventory.license.spdxId !== 'MIT') {
  throw new Error(`Expected the documented SPDX identifier to be MIT, received ${productInventory.license.spdxId}`)
}
console.log(`✓ product licensing status: ${productInventory.license.status} (${productInventory.license.spdxId})`)

function tarString(buffer, start, length) {
  return buffer
    .subarray(start, start + length)
    .toString('utf8')
    .replace(/\0.*$/, '')
    .trim()
}

function readTarFiles(archive) {
  const files = new Map()
  let offset = 0

  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) {
      break
    }

    const name = tarString(header, 0, 100)
    const prefix = tarString(header, 345, 155)
    const size = Number.parseInt(tarString(header, 124, 12) || '0', 8)
    const type = String.fromCharCode(header[156] || 0)
    const fullName = prefix ? `${prefix}/${name}` : name
    const repositoryPath = fullName.split('/').slice(1).join('/')
    const dataStart = offset + 512

    if ((type === '\0' || type === '0') && repositoryPath) {
      files.set(repositoryPath, archive.subarray(dataStart, dataStart + size).toString('utf8'))
    }

    offset = dataStart + Math.ceil(size / 512) * 512
  }

  return files
}

const archiveUrl = `https://api.github.com/repos/${repositoryPath}/tarball/${productCommit}`
const archiveResponse = await fetch(archiveUrl, {
  headers: githubHeaders,
  redirect: 'follow',
  signal: AbortSignal.timeout(30_000)
})
if (!archiveResponse.ok) {
  throw new Error(`Could not inspect the pinned product environment contract (${archiveResponse.status})`)
}

const productFiles = readTarFiles(gunzipSync(Buffer.from(await archiveResponse.arrayBuffer())))
const sourceVariables = new Set()
const environmentPattern = /process\.env(?:\.([A-Z][A-Z0-9_]*)|\[['"]([A-Z][A-Z0-9_]*)['"]\])/g
for (const [path, source] of productFiles) {
  if (!/\.(?:[cm]?[jt]s|tsx|vue)$/.test(path)) {
    continue
  }
  for (const match of source.matchAll(environmentPattern)) {
    sourceVariables.add(match[1] || match[2])
  }
}

const actualDirectVariables = [...sourceVariables].sort()
const expectedDirectVariables = [...productEnvironment.directVariables].sort()
if (JSON.stringify(actualDirectVariables) !== JSON.stringify(expectedDirectVariables)) {
  throw new Error(
    [
      'Documented direct environment variables do not match the pinned product source.',
      `Source: ${actualDirectVariables.join(', ')}`,
      `Documented: ${expectedDirectVariables.join(', ')}`
    ].join('\n')
  )
}

const productEnvExample = productFiles.get('.env.example')
if (!productEnvExample) {
  throw new Error('Pinned product source does not contain .env.example')
}
const exampleVariables = productEnvExample
  .split(/\r?\n/)
  .map((line) => line.replace(/^\uFEFF/, '').trim())
  .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
  .map((line) => line.slice(0, line.indexOf('=')))
  .sort()
const expectedExampleVariables = [
  ...new Set([
    ...productEnvironment.directVariables.filter(
      (variable) => !productEnvironment.exampleExclusions.includes(variable)
    ),
    ...productEnvironment.libraryVariables.filter(
      (variable) => !productEnvironment.knownExampleOmissions.includes(variable)
    )
  ])
].sort()
if (JSON.stringify(exampleVariables) !== JSON.stringify(expectedExampleVariables)) {
  throw new Error(
    [
      'Pinned product .env.example does not match the documented environment contract.',
      `Product example: ${exampleVariables.join(', ')}`,
      `Documented: ${expectedExampleVariables.join(', ')}`
    ].join('\n')
  )
}

const configurationReference = await readFile(
  new URL('../content/4.reference/2.configuration.md', import.meta.url),
  'utf8'
)
for (const variable of [
  ...productEnvironment.directVariables,
  ...productEnvironment.libraryVariables,
  ...productEnvironment.runtimeVariables
]) {
  if (!configurationReference.includes(`\`${variable}\``)) {
    throw new Error(`Configuration reference does not document ${variable}`)
  }
}
console.log(
  `✓ product environment contract: ${actualDirectVariables.length} direct, ${productEnvironment.libraryVariables.length} library-owned, ${productEnvironment.runtimeVariables.length} runtime variables`
)
