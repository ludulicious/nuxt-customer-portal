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
  source.dependencies.vue = '^3.5.0'
  await writeFile(join(destination, 'package.json'), JSON.stringify(source, null, 2) + '\n')
  await writeFile(
    join(destination, 'eslint.config.mjs'),
    "import withNuxt from './.nuxt/eslint.config.mjs'\nexport default withNuxt()\n"
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await prepareTemplate()
  console.log('Prepared the configurable portal starter from apps/saas-portal.')
}
