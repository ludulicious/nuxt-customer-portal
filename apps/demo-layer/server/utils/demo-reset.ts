import { Pool } from 'pg'
import { demoDay, seedDemoData } from './demo-data'

export const demoLock = 904004
// Separate pool: waiting request locks must not exhaust the application's query pool.
export const demoPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 30 })

export async function resetDemoIfDue() {
  const client = await demoPool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [demoLock])
    const {
      rows: [database]
    } = await client.query('SELECT current_database() AS name')
    if (!database.name.endsWith('_demo')) {
      throw new Error('Demo mode requires a dedicated database whose name ends in _demo')
    }
    await client.query(
      'CREATE TABLE IF NOT EXISTS public.portal_demo_reset (id boolean PRIMARY KEY DEFAULT true CHECK(id), reset_day text NOT NULL)'
    )
    const {
      rows: [state]
    } = await client.query('SELECT reset_day FROM public.portal_demo_reset WHERE id = true')
    const day = demoDay()
    if (state?.reset_day !== day) {
      // Refuse to adopt a populated regular deployment, even if its database was renamed.
      if (!state) {
        const {
          rows: [existing]
        } = await client.query('SELECT count(*)::int AS count FROM public."user"')
        if (existing.count) {
          throw new Error('Initial demo setup requires an empty, migrated database')
        }
      }
      const { rows: tables } = await client.query(`SELECT schemaname, tablename FROM pg_tables WHERE
        schemaname IN ('clients', 'timesheets', 'invoices', 'invoice_timesheets', 'service_requests', 'saas_configuration')
        OR (schemaname = 'public' AND tablename IN ('user', 'session', 'account', 'verification', 'organization', 'member', 'invitation', 'portal_email_settings', 'organization_email_credential'))`)
      const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"'
      await client.query(
        `TRUNCATE ${tables.map((table) => `${quote(table.schemaname)}.${quote(table.tablename)}`).join(', ')} RESTART IDENTITY`
      )
      await seedDemoData(client, day)
      await client.query(
        'INSERT INTO public.portal_demo_reset (id, reset_day) VALUES (true, $1) ON CONFLICT (id) DO UPDATE SET reset_day = EXCLUDED.reset_day',
        [day]
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
