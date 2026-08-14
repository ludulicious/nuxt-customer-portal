import { defineConfig } from 'drizzle-kit'

export default defineConfig({ dialect: 'postgresql', schema: './server/db/schema/clients.ts', out: './migrations' })
