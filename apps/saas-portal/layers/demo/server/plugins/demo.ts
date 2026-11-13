import { isPortalDemo } from '@nuxt-customer-portal/core/server/utils/demo'
import { demoDay, nextDemoReset } from '../utils/demo-data'
import { demoPool, demoLock, resetDemoIfDue } from '../utils/demo-reset'

export default defineNitroPlugin((nitro) => {
  const config = useRuntimeConfig()
  if (Boolean(config.portalDemo.enabled) !== Boolean(config.public.portalDemo.enabled)) {
    throw new Error('Demo mode requires matching NUXT_PORTAL_DEMO_ENABLED and NUXT_PUBLIC_PORTAL_DEMO_ENABLED flags')
  }
  if (import.meta.prerender || !isPortalDemo()) {
    return
  }
  let lastDay = demoDay()
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  const schedule = () => {
    if (stopped) {
      return
    }
    timer = setTimeout(async () => {
      try {
        lastDay = await resetDemoIfDue()
      } catch (error) {
        console.error('Demo reset failed; requests will retry before serving data', error)
      }
      schedule()
    }, nextDemoReset().getTime() - Date.now())
    timer.unref()
  }
  // Nitro does not await async plugin return values. Register the request gate
  // synchronously and refuse startup if initialization cannot safely complete.
  const ready = resetDemoIfDue()
    .then((day) => {
      lastDay = day
      schedule()
    })
    .catch((error) => {
      console.error('Demo initialization failed', error)
      process.exit(1)
    })
  nitro.hooks.hook('request', async (event) => {
    await ready
    if (!event.path.startsWith('/api/')) {
      return
    }
    // Also catch up after downtime or a failed timer; never serve yesterday's dataset.
    if (lastDay !== demoDay()) {
      lastDay = await resetDemoIfDue()
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
