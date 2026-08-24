import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/db/schema/invoice-timesheets.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/customer_portal' },
  migrations: { table: '__drizzle_migrations_invoice_timesheets', schema: 'drizzle' }
})
