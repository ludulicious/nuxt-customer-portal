import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createRequestAwareDatabase } from './runtime-db'

// Declare globals to avoid multiple instances in development
declare global {
  var portalDatabase: ReturnType<typeof drizzle> | undefined
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const fallbackDatabase = globalThis.portalDatabase || drizzle(pool)

export const db = createRequestAwareDatabase(fallbackDatabase)

// If in development, assign the instances to the global variables
if (process.env.NODE_ENV !== 'production') {
  globalThis.portalDatabase = fallbackDatabase
}
