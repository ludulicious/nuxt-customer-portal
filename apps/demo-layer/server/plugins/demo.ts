import { isPortalDemo } from '@nuxt-customer-portal/core/server/utils/demo'
import { demoDay, nextDemoReset } from '../utils/demo-data'
import { demoPool, demoLock, resetDemoIfDue } from '../utils/demo-reset'

export default defineNitroPlugin(async (nitro) => {
  if (import.meta.prerender || !isPortalDemo()) {
    return
  }
  await resetDemoIfDue()
  let lastDay = demoDay()
  let timer: ReturnType<typeof setTimeout>
  let stopped = false
  const schedule = () => {
    if (stopped) {
      return
    }
    timer = setTimeout(async () => {
      try {
        await resetDemoIfDue()
        lastDay = demoDay()
      } catch (error) {
        console.error('Demo reset failed; requests will retry before serving data', error)
      }
      schedule()
    }, nextDemoReset().getTime() - Date.now())
    timer.unref()
  }
  schedule()
  nitro.hooks.hook('request', async (event) => {
    if (!event.path.startsWith('/api/')) {
      return
    }
    // Also catch up after downtime or a failed timer; never serve yesterday's dataset.
    if (lastDay !== demoDay()) {
      await resetDemoIfDue()
      lastDay = demoDay()
    }
    const client = await demoPool.connect()
    try {
      await client.query('SELECT pg_advisory_lock_shared($1)', [demoLock])
    } catch (error) {
      client.release(true)
      throw error
    }
    let released = false
    const release = async () => {
      if (released) {
        return
      }
      released = true
      try {
        await client.query('SELECT pg_advisory_unlock_shared($1)', [demoLock])
        client.release()
      } catch {
        client.release(true)
      }
    }
    event.node.res.once('finish', release)
    event.node.res.once('close', release)
    if (event.node.res.destroyed || event.node.res.writableFinished) {
      await release()
    }
    setResponseHeader(event, 'Cache-Control', 'no-store')
  })
  nitro.hooks.hook('close', async () => {
    stopped = true
    clearTimeout(timer)
    await demoPool.end()
  })
})
