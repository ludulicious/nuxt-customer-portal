import type { PoolClient, QueryResultRow } from 'pg'
import { pool } from '@nuxt-customer-portal/core/server/utils/db'

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const value = await work(client)
    await client.query('COMMIT')
    return value
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
export async function rows<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  client: Pick<PoolClient, 'query'> = pool
): Promise<T[]> {
  return (await client.query<T>(sql, params)).rows
}
