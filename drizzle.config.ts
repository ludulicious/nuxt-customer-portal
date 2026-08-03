import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: [
    './layers/portal-core/server/db/schema/**/*.ts',
    './layers/*/server/db/schema/**/*.ts'
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
