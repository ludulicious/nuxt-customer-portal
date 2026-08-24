import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema/service-requests.ts',
  out: './migrations'
})
