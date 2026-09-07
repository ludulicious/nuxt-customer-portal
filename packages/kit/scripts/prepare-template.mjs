import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const kitRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(kitRoot, '../..')

export async function prepareTemplate(destination = join(kitRoot, 'templates/saas-portal')) {
  const host = join(repositoryRoot, 'apps/saas-portal')
  await rm(destination, { recursive: true, force: true })
  await mkdir(destination, { recursive: true })
  for (const entry of ['app', 'i18n', 'public', 'server', 'nuxt.config.ts', 'portal.config.ts', 'tsconfig.json']) {
    await cp(join(host, entry), join(destination, entry), { recursive: true })
  }
  const source = JSON.parse(await readFile(join(host, 'package.json'), 'utf8'))
  for (const [name, version] of Object.entries(source.dependencies)) {
    if (version.startsWith('workspace:')) {
      source.dependencies[name] = JSON.parse(
        await readFile(join(repositoryRoot, 'packages', name.split('/')[1], 'package.json'), 'utf8')
      ).version
    }
  }
  const repositoryManifest = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
  source.scripts.lint = 'eslint . --max-warnings=0'
  source.scripts.format = repositoryManifest.scripts.format.replace(/eslint \./g, 'eslint . --max-warnings=0')
  source.scripts['format:check'] = 'prettier --check . && eslint . --max-warnings=0'
  for (const name of ['prettier', 'eslint-config-prettier']) {
    source.devDependencies[name] = repositoryManifest.devDependencies[name]
  }
  for (const entry of ['eslint-formatting.config.mjs', '.prettierrc.json']) {
    await cp(join(repositoryRoot, entry), join(destination, entry))
  }
  await writeFile(
    join(destination, '.prettierignore'),
    '# Generated outputs and local data\nnode_modules/\n.nuxt/\n.output/\n.data/\n.nitro/\n.cache/\ndist/\ncoverage/\n.env\n.env.*\n# Package-manager lockfiles retain their native formatting.\npnpm-lock.yaml\npackage-lock.json\nyarn.lock\nbun.lock\nbun.lockb\n'
  )
  source.dependencies.vue = '^3.5.0'
  await writeFile(join(destination, 'package.json'), JSON.stringify(source, null, 2) + '\n')
  await writeFile(
    join(destination, 'eslint.config.mjs'),
    "import withNuxt from './.nuxt/eslint.config.mjs'\nimport { formattingConfigs } from './eslint-formatting.config.mjs'\n\nexport default withNuxt().append(...formattingConfigs)\n"
  )

  const pages = resolve(destination, '../pages')
  await rm(pages, { recursive: true, force: true })
  await mkdir(join(pages, 'saas-configuration'), { recursive: true })
  await mkdir(join(pages, 'authentication'), { recursive: true })
  for (const page of ['index.vue', 'privacy.vue', 'terms.vue']) {
    await cp(
      join(repositoryRoot, 'packages/saas-configuration/app/pages', page),
      join(pages, 'saas-configuration', page)
    )
  }
  await cp(join(repositoryRoot, 'packages/authentication/app/pages/login.vue'), join(pages, 'authentication/login.vue'))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await prepareTemplate()
  console.log('Prepared the configurable portal starter from apps/saas-portal.')
}
