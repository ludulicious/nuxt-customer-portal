import { AsyncLocalStorage } from 'node:async_hooks'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export interface PortalRequestContext {
  database: NodePgDatabase<Record<string, unknown>>
  auth?: object
  workspace?: {
    id: string
    slug: string
    lifecycleStatus: string
    canonicalDomain: string
    enabledModules?: string[]
    authSecret?: string
  }
  mode: 'fixed' | 'platform' | 'workspace'
}

const storage = new AsyncLocalStorage<PortalRequestContext>()

export const getPortalRequestContext = () => storage.getStore()

export const runWithPortalRequestContext = <T>(context: PortalRequestContext, callback: () => T) =>
  storage.run(context, callback)

export const enterPortalRequestContext = (context: PortalRequestContext) => storage.enterWith(context)
