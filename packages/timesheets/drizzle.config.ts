import { defineConfig } from 'drizzle-kit'

export default defineConfig({ dialect: 'postgresql', schema: './server/db/schema/timesheets.ts', out: './migrations' })
