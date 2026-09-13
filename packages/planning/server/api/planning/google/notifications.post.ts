import { defineEventHandler, getHeader, setResponseStatus } from 'h3'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { pool } from '@nuxt-customer-portal/core/server/utils/db'
import { digest } from '../../../utils/crypto'
import { enqueue } from '../../../utils/booking'

export default defineEventHandler(async (event) => {
  const [watch] = await rows<{ store_id: string; user_id: string }>(
    'SELECT store_id,user_id FROM planning.watch WHERE id::text=$1 AND token_hash=$2 AND (resource_id IS NULL OR resource_id=$3) AND expires_at>now()',
    [
      getHeader(event, 'x-goog-channel-id') || '',
      digest(getHeader(event, 'x-goog-channel-token') || ''),
      getHeader(event, 'x-goog-resource-id') || ''
    ]
  )
  if (watch) {
    await enqueue(pool, `sync:${watch.store_id}:${watch.user_id}:${Math.floor(Date.now() / 1000)}`, 'sync', {
      storeId: watch.store_id,
      userId: watch.user_id
    })
  }
  setResponseStatus(event, 204)
})
