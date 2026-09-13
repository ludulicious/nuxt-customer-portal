import { pool } from '@nuxt-customer-portal/core/server/utils/db'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { expireReservations, runJobs } from '../../utils/jobs'
import { enqueue } from '../../utils/booking'

export default defineTask({
  meta: {
    name: 'planning:reconcile',
    description: 'Expire booking holds, synchronize calendars and retry appointment effects'
  },
  async run() {
    let expiryError = false
    try {
      await expireReservations()
    } catch {
      expiryError = true
    }
    const users = await rows<{ store_id: string; user_id: string }>(
      `SELECT p.store_id,p.user_id FROM planning.provider p JOIN planning.connection c ON c.store_id=p.store_id AND c.user_id=p.user_id AND c.provider='google' AND c.healthy WHERE cardinality(p.busy_calendar_ids)>0`
    )
    for (const u of users) {
      await enqueue(pool, `sync:${u.store_id}:${u.user_id}:${Math.floor(Date.now() / 300000)}`, 'sync', {
        storeId: u.store_id,
        userId: u.user_id
      })
    }
    return { result: { ...(await runJobs()), expiryError } }
  }
})
