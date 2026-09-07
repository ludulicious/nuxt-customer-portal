import { constants } from 'node:fs'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultTemplateRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../templates/pages')

export const portalPages = {
  home: { source: 'saas-configuration/index.vue', destination: 'app/pages/index.vue' },
  privacy: { source: 'saas-configuration/privacy.vue', destination: 'app/pages/privacy.vue' },
  terms: { source: 'saas-configuration/terms.vue', destination: 'app/pages/terms.vue' },
  login: {
    source: 'authentication/login.vue',
    destination: 'app/pages/login.vue',
    dependencies: { zod: '^4.4.3' }
  }
}

const exists = async (path) => {
  try {
    await access(path, constants.F_OK)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

export async function copyPortalPages({ cwd, pages, templateRoot = defaultTemplateRoot }) {
  const selected = [...new Set(pages)]
  const unknown = selected.filter((page) => !portalPages[page])
  if (!selected.length || unknown.length) {
    throw new Error(
      unknown.length
        ? `Unknown page${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Choose from ${Object.keys(portalPages).join(', ')}.`
        : `Choose at least one page: ${Object.keys(portalPages).join(', ')}.`
    )
  }

  const root = resolve(cwd)
  const files = selected.map((page) => ({
    page,
    ...portalPages[page],
    target: join(root, portalPages[page].destination)
  }))
  const conflicts = []
  for (const file of files) {
    if (await exists(file.target)) {
      conflicts.push(file.destination)
    }
  }
  if (conflicts.length) {
    throw new Error(`No files were changed. These local files already exist: ${conflicts.join(', ')}`)
  }

  const packagePath = join(root, 'package.json')
  let manifest
  try {
    manifest = JSON.parse(await readFile(packagePath, 'utf8'))
  } catch {
    throw new Error('No valid package.json was found in the portal host.')
  }
  const additions = Object.assign({}, ...files.map((file) => file.dependencies || {}))
  const dependencies = { ...(manifest.dependencies || {}) }
  let manifestChanged = false
  for (const [name, version] of Object.entries(additions)) {
    if (!dependencies[name] && !manifest.devDependencies?.[name]) {
      dependencies[name] = version
      manifestChanged = true
    }
  }

  // Read every source before creating directories or files, so missing package
  // templates cannot leave a partially customized host.
  const contents = await Promise.all(
    files.map(async (file) => {
      try {
        return await readFile(join(templateRoot, file.source), 'utf8')
      } catch {
        throw new Error('Page templates are missing. Reinstall @nuxt-customer-portal/kit and try again.')
      }
    })
  )
  for (let index = 0; index < files.length; index++) {
    await mkdir(dirname(files[index].target), { recursive: true })
    await writeFile(files[index].target, contents[index], { flag: 'wx' })
  }
  if (manifestChanged) {
    manifest.dependencies = dependencies
    await writeFile(packagePath, JSON.stringify(manifest, null, 2) + '\n')
  }
  return { files: files.map((file) => file.destination), dependenciesAdded: manifestChanged ? additions : {} }
}
