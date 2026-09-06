import * as prompts from '@clack/prompts'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createJiti } from 'jiti'
import { resolvePortalManifests } from './runtime.mjs'
import {
  assertEmptyDestination,
  availablePort,
  createStarter,
  hasControlCharacters,
  initializeStarter,
  packageManagers,
  validateDatabaseUrl,
  validateEmail,
  validateName
} from './starter.mjs'

const answer = async (prompt) => {
  const value = await prompt
  if (prompts.isCancel(value)) {
    const error = new Error('Setup cancelled. You can run the command again when ready.')
    error.code = 'CANCELLED'
    throw error
  }
  return value
}

export const runCommand = (command, args, cwd) =>
  new Promise((done, reject) => {
    // No shell: project paths and answers never become executable command text.
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: false })
    child.once('error', () => reject(new Error(`Could not start ${command}. Check that it is installed.`)))
    child.once('exit', (code) =>
      code === 0 ? done() : reject(new Error(`${command} failed. Correct the reported problem and retry setup.`))
    )
  })

export async function runInit(args) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { help: { type: 'boolean', short: 'h' }, 'no-install': { type: 'boolean' } }
  })
  if (values.help) {
    console.log(`Usage: nuxt-customer-portal init [directory] [--no-install]

Create a standalone configurable portal. The wizard asks for your organization,
administrator, package manager, and a local Docker or empty PostgreSQL database.
It generates secrets, installs dependencies, migrates, and creates your owner.
Use --no-install to generate files and run the printed setup commands later.`)
    return
  }
  if (positionals.length > 1) {
    throw new Error('Supply only one destination directory.')
  }
  if (!process.stdin.isTTY) {
    throw new Error('Run init in an interactive terminal so it can ask the setup questions.')
  }
  prompts.intro('Create your Nuxt Customer Portal')
  const directory = resolve(
    positionals[0] ||
      (await answer(
        prompts.text({
          message: 'Where should we create your portal?',
          initialValue: 'my-customer-portal',
          validate: (value) => (!value?.trim() || hasControlCharacters(value) ? 'Enter a directory name.' : undefined)
        })
      ))
  )
  await assertEmptyDestination(directory)
  const organizationName = await answer(
    prompts.text({ message: 'What is your organization called?', validate: validateName })
  )
  const userName = await answer(prompts.text({ message: 'What is the administrator’s name?', validate: validateName }))
  const userEmail = await answer(prompts.text({ message: 'Administrator email address', validate: validateEmail }))
  const detectedManager = process.env.npm_config_user_agent?.split('/')[0]
  const packageManager = await answer(
    prompts.select({
      message: 'Which package manager should we use?',
      initialValue: packageManagers.includes(detectedManager) ? detectedManager : 'npm',
      options: packageManagers.map((value) => ({ value, label: value }))
    })
  )
  const database = await answer(
    prompts.select({
      message: 'How should we run PostgreSQL?',
      initialValue: 'docker',
      options: [
        { value: 'docker', label: 'Start a local database with Docker', hint: 'requires Docker Compose' },
        { value: 'existing', label: 'Connect to an empty PostgreSQL database' }
      ]
    })
  )
  let databaseUrl
  if (database === 'existing') {
    prompts.note(
      [
        'Format: postgresql://username:password@host:5432/database',
        'Example: postgresql://portal:my-password@localhost:5432/my_portal',
        '',
        'Replace the username, password, host, port, and database with your own.',
        'Use an empty database. Your database provider may supply the full URL;',
        'keep any options at the end, such as ?sslmode=require.',
        'In usernames and passwords, encode special characters: @ becomes %40, # becomes %23.'
      ].join('\n'),
      'Connect to your PostgreSQL database'
    )
    databaseUrl = await answer(
      prompts.text({
        message: 'PostgreSQL connection URL (visible while editing; saved in .env)',
        placeholder: 'postgresql://username:password@localhost:5432/my_portal',
        validate: validateDatabaseUrl
      })
    )
  }
  const port = await availablePort(3000)
  const databasePort = database === 'docker' ? await availablePort(5433) : 5433
  const generated = await createStarter({
    directory,
    organizationName,
    userName,
    userEmail,
    packageManager,
    database,
    databaseUrl,
    port,
    databasePort
  })
  prompts.log.success(`Created ${generated.directory}`)
  if (values['no-install']) {
    prompts.outro(
      `Next: change into the new directory, then run ${packageManager} install, ${packageManager} run setup, and ${packageManager} run dev.`
    )
    return
  }
  try {
    prompts.log.step('Installing the portal packages…')
    await runCommand(packageManager, ['install'], directory)
    await runCommand(packageManager, ['run', 'setup'], directory)
  } catch (error) {
    prompts.log.info(
      `Your files are preserved in ${directory}. After correcting the problem, run ${packageManager} install and ${packageManager} run setup there.`
    )
    throw error
  }
  prompts.outro(
    `Your portal is ready. Run ${packageManager} run dev in ${directory}, then open http://localhost:${port}/login.`
  )
}

export async function runSetup(args) {
  if (args.length) {
    if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
      console.log(
        'Usage: nuxt-customer-portal setup\nRun the generated project’s setup script to load .env, initialize its database, and create the administrator.'
      )
      return
    }
    throw new Error('setup accepts no arguments. Run it from the generated project.')
  }
  const cwd = process.cwd()
  let metadata
  try {
    metadata = JSON.parse(await readFile(resolve(cwd, 'portal.setup.json'), 'utf8'))
  } catch {
    throw new Error('No valid portal.setup.json found. Run init to create a new portal first.')
  }
  if (
    validateName(metadata.organizationName) ||
    validateName(metadata.userName) ||
    validateEmail(metadata.userEmail) ||
    !/^[a-z0-9-]+$/.test(metadata.organizationSlug || '') ||
    !/^[0-9a-f-]{36}$/i.test(metadata.id || '') ||
    !['docker', 'existing'].includes(metadata.database)
  ) {
    throw new Error('Invalid portal.setup.json. Restore the generated setup metadata before retrying.')
  }
  if (validateDatabaseUrl(process.env.DATABASE_URL)) {
    throw new Error('Set DATABASE_URL in .env and run your package manager’s setup script.')
  }
  const jiti = createJiti(resolve(cwd, 'package.json'), { interopDefault: true })
  const config = await jiti.import(resolve(cwd, 'portal.config.ts'), { default: true })
  await resolvePortalManifests(config, cwd)
  const { defaultPortalSettings } = await jiti.import('@nuxt-customer-portal/saas-configuration/shared/settings')
  prompts.intro('Prepare your portal')
  if (metadata.database === 'docker') {
    prompts.log.step('Starting the local PostgreSQL database…')
    await runCommand('docker', ['compose', 'up', '-d', '--wait', '--wait-timeout', '90', 'db'], cwd)
  }
  const getPassword = async () => {
    if (!process.stdin.isTTY) {
      throw new Error('Run setup in an interactive terminal to choose the administrator password.')
    }
    const password = await answer(
      prompts.password({
        message: 'Choose the administrator password',
        validate: (value) =>
          !value || value.length < 12 || value.length > 128 ? 'Use between 12 and 128 characters.' : undefined
      })
    )
    await answer(
      prompts.password({
        message: 'Confirm the administrator password',
        validate: (value) => (value === password ? undefined : 'The passwords do not match.')
      })
    )
    prompts.log.step('Applying migrations and creating the administrator…')
    return password
  }
  const result = await initializeStarter({
    cwd,
    config,
    metadata,
    databaseUrl: process.env.DATABASE_URL,
    getPassword,
    defaultSettings: defaultPortalSettings
  })
  prompts.outro(
    result.alreadyComplete
      ? 'This portal has already been set up. Existing credentials are unchanged.'
      : 'Administrator created. Start the portal, sign in, and finish branding and module setup in your browser.'
  )
}

export async function runStarterCommand(command, args) {
  try {
    await (command === 'init' ? runInit(args) : runSetup(args))
  } catch (error) {
    const message = String(error.message || error).replace(/postgres(?:ql)?:\/\/\S+/gi, '[database URL]')
    if (error.code === 'CANCELLED') {
      prompts.cancel(message)
      process.exitCode = 130
    } else {
      prompts.log.error(message)
      process.exitCode = 1
    }
  }
}
