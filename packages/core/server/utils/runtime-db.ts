import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { getPortalRequestContext } from './request-context'

type DatabaseMethod = (...args: never[]) => unknown

/**
 * A request-aware database facade. Existing fixed-database hosts continue to
 * use the fallback database, while SaaS requests can select a database through
 * AsyncLocalStorage before any Core or feature handler executes.
 */
export const createRequestAwareDatabase = (fallback: NodePgDatabase<Record<string, unknown>>) =>
  new Proxy(fallback, {
    get(_target, property, receiver) {
      const database = getPortalRequestContext()?.database ?? fallback
      const value = Reflect.get(database, property, database)
      return typeof value === 'function'
        ? (value as DatabaseMethod).bind(database)
        : value
    }
  }) as NodePgDatabase<Record<string, unknown>>
