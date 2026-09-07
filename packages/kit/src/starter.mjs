import { randomBytes, randomUUID } from 'node:crypto'
import { cp, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { assignPortalSystemAdmin, migratePortalDatabase, seedPortalProvider } from './runtime.mjs'

const templateRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../templates/saas-portal')
export const packageManagers = ['npm', 'pnpm', 'yarn', 'bun']
export const hasControlCharacters = (value) =>
  [...value].some((character) => {
    const code = character.codePointAt(0)
    return code < 32 || code === 127
  })
export const slugify = (value) =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'my-portal'

export function validateName(value) {
  return typeof value !== 'string' || value.trim().length < 2 || value.length > 100 || hasControlCharacters(value)
    ? 'Enter between 2 and 100 characters.'
    : undefined
}

export function validateEmail(value) {
  return typeof value !== 'string' || value.length > 254 || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)
    ? 'Enter a valid administrator email address.'
    : undefined
}

export function validateDatabaseUrl(value) {
  try {
    const url = new URL(value)
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2 ||
      /[\s'"`]/.test(value)
    ) {
      return 'Use a PostgreSQL URL with a database name; percent-encode special characters.'
    }
  } catch {
    return 'Enter a PostgreSQL connection URL.'
  }
}

export async function assertEmptyDestination(directory) {
  if (typeof directory !== 'string' || !directory.trim() || hasControlCharacters(directory)) {
    throw new Error('Enter a valid directory name.')
  }
  let stat
  try {
    stat = await lstat(directory)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return
    }
    throw error
  }
  if (stat.isSymbolicLink() || !stat.isDirectory() || (await readdir(directory)).length) {
    throw new Error('Choose a new or empty directory. Existing files will not be overwritten.')
  }
}

export async function availablePort(start) {
  for (let port = start; port < start + 100; port++) {
    const available = await new Promise((done) => {
      const server = createServer()
      server.once('error', () => done(false))
      server.listen(port, () => server.close(() => done(true)))
    })
    if (available) {
      return port
    }
  }
  throw new Error(`No available local port found starting at ${start}.`)
}

export async function createStarter(input, options = {}) {
  const directory = resolve(input.directory)
  for (const [key, validator] of [
    ['organizationName', validateName],
    ['userName', validateName],
    ['userEmail', validateEmail]
  ]) {
    const error = validator(input[key])
    if (error) {
      throw new Error(`${key}: ${error}`)
    }
  }
  if (!packageManagers.includes(input.packageManager) || !['docker', 'existing'].includes(input.database)) {
    throw new Error('Choose a supported package manager and database option.')
  }
  if (input.database === 'existing' && validateDatabaseUrl(input.databaseUrl)) {
    throw new Error(validateDatabaseUrl(input.databaseUrl))
  }
  for (const port of [input.port, input.databasePort]) {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      throw new Error('Ports must be integers between 1024 and 65535.')
    }
  }
  await assertEmptyDestination(directory)
  const template = options.templateRoot || templateRoot
  let source
  try {
    source = JSON.parse(await readFile(join(template, 'package.json'), 'utf8'))
  } catch {
    throw new Error(
      'Starter template is missing. In the source checkout run pnpm --filter @nuxt-customer-portal/kit build:template first.'
    )
  }
  await mkdir(directory, { recursive: true })
  for (const entry of await readdir(template)) {
    await cp(join(template, entry), join(directory, entry), {
      recursive: true,
      force: false,
      errorOnExist: true
    })
  }
  const cli = 'node --env-file=.env ./node_modules/@nuxt-customer-portal/kit/bin/nuxt-customer-portal.mjs'
  const projectName = slugify(basename(directory))
  const metadata = {
    id: randomUUID(),
    organizationName: input.organizationName.trim(),
    organizationSlug: slugify(input.organizationName),
    userName: input.userName.trim(),
    userEmail: input.userEmail.trim().toLowerCase(),
    database: input.database,
    port: input.port
  }
  source.name = projectName
  delete source.version
  source.scripts = {
    ...source.scripts,
    dev: `nuxt dev --host localhost --port ${input.port}`,
    setup: `${cli} setup`,
    portal: cli,
    ...(input.database === 'docker'
      ? { 'db:start': 'docker compose up -d --wait db', 'db:stop': 'docker compose stop db' }
      : {})
  }
  if (input.packageManager === 'pnpm') {
    await writeFile(
      join(directory, 'pnpm-workspace.yaml'),
      "packages:\n  - '.'\nonlyBuiltDependencies:\n  - sharp\n  - esbuild\n"
    )
  }
  if (input.packageManager === 'yarn') {
    await writeFile(join(directory, '.yarnrc.yml'), 'nodeLinker: node-modules\n')
  }
  const password = randomBytes(24).toString('hex')
  const databaseUrl =
    input.database === 'docker'
      ? `postgresql://portal:${password}@localhost:${input.databasePort}/portal`
      : input.databaseUrl
  const environment =
    [
      `DATABASE_URL='${databaseUrl}'`,
      `BETTER_AUTH_SECRET=${randomBytes(48).toString('hex')}`,
      `PORTAL_EMAIL_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}`,
      `PUBLIC_URL=http://localhost:${input.port}`,
      `BETTER_AUTH_URL=http://localhost:${input.port}`,
      `ADMIN_EMAILS=${metadata.userEmail}`,
      'PORTAL_REGISTRATION_MODE=invitation-only',
      'RESEND_API_KEY=',
      'RESEND_FROM_EMAIL=',
      ...(input.database === 'docker' ? [`POSTGRES_PASSWORD=${password}`] : [])
    ].join('\n') + '\n'
  await writeFile(join(directory, 'package.json'), JSON.stringify(source, null, 2) + '\n')
  await writeFile(join(directory, 'portal.setup.json'), JSON.stringify(metadata, null, 2) + '\n')
  await writeFile(join(directory, '.env'), environment, { mode: 0o600, flag: 'wx' })
  await writeFile(
    join(directory, '.env.example'),
    [
      'DATABASE_URL=',
      'BETTER_AUTH_SECRET=',
      'PORTAL_EMAIL_ENCRYPTION_KEY=',
      `PUBLIC_URL=http://localhost:${input.port}`,
      `BETTER_AUTH_URL=http://localhost:${input.port}`,
      'ADMIN_EMAILS=',
      'PORTAL_REGISTRATION_MODE=invitation-only',
      'RESEND_API_KEY=',
      'RESEND_FROM_EMAIL=',
      ...(input.database === 'docker' ? ['POSTGRES_PASSWORD='] : [])
    ].join('\n') + '\n'
  )
  await writeFile(
    join(directory, '.gitignore'),
    '.env\n.env.*\n!.env.example\nnode_modules/\n.nuxt/\n.output/\n.data/\n*.log\n.DS_Store\n'
  )
  if (input.database === 'docker') {
    await writeFile(
      join(directory, 'compose.yaml'),
      `services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: portal
      POSTGRES_USER: portal
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
    ports:
      - '127.0.0.1:${input.databasePort}:5432'
    volumes:
      - portal-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U portal -d portal']
      interval: 2s
      timeout: 5s
      retries: 30
volumes:
  portal-data:
`
    )
  }
  await writeFile(
    join(directory, 'README.md'),
    `# ${metadata.organizationName}

Generated from the Nuxt Customer Portal configurable application.

## Run locally

\`\`\`sh
${input.packageManager} install
${input.packageManager} run setup
${input.packageManager} run dev
\`\`\`

Sign in at http://localhost:${input.port}/login with the administrator account
created during setup. Complete branding, modules, homepage, and legal content in
the browser onboarding. Timesheets, Invoices, and their bridge start selected;
Service Requests is an optional example.

Setup generates unique secrets in the ignored .env file. It only initializes an
empty database or resumes this starter's own setup. It never resets a password.
${input.database === 'docker' ? `Use \`${input.packageManager} run db:stop\` to stop PostgreSQL without deleting its data.\n` : ''}
Configure email delivery before inviting clients or sending invoices. Review the
[deployment guide](https://nuxt-customer-portal.com/getting-started/deployment)
before exposing the portal publicly. Keep .env private and supply secrets through
your deployment environment. This development setup does not deploy the portal.

## Code quality

Run \`${input.packageManager} run lint\` to check code with zero warnings allowed.
Run \`${input.packageManager} run format\` to apply Prettier formatting and ESLint fixes.
Run \`${input.packageManager} run format:check\` to check both without modifying files.
Formatting settings are included in this project; no global tooling is required.

Add your modules in portal.config.ts. The host's app, assets, and configuration
are yours to customize; business modules remain versioned package dependencies.
`
  )
  return { directory, metadata }
}

// Refuse unrelated databases. The marker also permits a retry after a failed
// migration without claiming another installation or resetting user credentials.
export async function claimDatabase(client, setupId) {
  await client.query('BEGIN')
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('nuxt-customer-portal:starter'))")
    const marker = await client.query("SELECT to_regclass('public.portal_starter_setup') AS name")
    if (marker.rows[0].name) {
      const existing = await client.query('SELECT setup_id, completed FROM public.portal_starter_setup WHERE id=true')
      if (existing.rows[0]?.setup_id !== setupId) {
        throw new Error('This database belongs to another starter. Choose an empty database.')
      }
      await client.query('COMMIT')
      return Boolean(existing.rows[0].completed)
    }
    const tables = await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f') LIMIT 1`)
    if (tables.rows.length) {
      throw new Error(
        'The database is not empty. Setup will not change an existing installation; choose an empty database.'
      )
    }
    await client.query(
      'CREATE TABLE public.portal_starter_setup (id boolean PRIMARY KEY DEFAULT true CHECK (id=true), setup_id uuid NOT NULL, completed boolean NOT NULL DEFAULT false)'
    )
    await client.query('INSERT INTO public.portal_starter_setup (setup_id) VALUES ($1)', [setupId])
    await client.query('COMMIT')
    return false
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

export async function initializeStarter({ cwd, config, metadata, databaseUrl, getPassword, defaultSettings }) {
  const pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 10_000, max: 1 })
  let client
  try {
    client = await pool.connect()
    const lock = await client.query(
      "SELECT pg_try_advisory_lock(hashtext('nuxt-customer-portal:setup-run')) AS acquired"
    )
    if (!lock.rows[0].acquired) {
      throw new Error('Another setup is running against this database. Wait for it to finish before retrying.')
    }
    const completed = await claimDatabase(client, metadata.id)
    if (completed) {
      return { alreadyComplete: true }
    }
    const userPassword = await getPassword()
    if (typeof userPassword !== 'string' || userPassword.length < 12 || userPassword.length > 128) {
      throw new Error('Use an administrator password between 12 and 128 characters.')
    }
    await migratePortalDatabase(config, { cwd, databaseUrl })
    await seedPortalProvider({ ...metadata, userPassword, databaseUrl })
    await assignPortalSystemAdmin({ email: metadata.userEmail, databaseUrl })
    await client.query(
      `INSERT INTO saas_configuration.portal_settings (id, settings)
      VALUES (true, $1::jsonb) ON CONFLICT (id) DO NOTHING`,
      [JSON.stringify(defaultSettings(metadata.organizationName))]
    )
    await client.query('UPDATE public.portal_starter_setup SET completed=true WHERE id=true AND setup_id=$1', [
      metadata.id
    ])
    return { alreadyComplete: false }
  } finally {
    client?.release()
    await pool.end()
  }
}
