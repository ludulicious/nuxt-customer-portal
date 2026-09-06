import { createHmac } from 'node:crypto'
import { getCookie, setCookie, type H3Event } from 'h3'
import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { pool } from '@nuxt-customer-portal/core/server/utils/db'
import { demoIdentities } from './identities'

export async function createDemoSession(event: H3Event, userId: string) {
  const identity = demoIdentities.find((user) => user.id === userId)
  if (!identity) {
    throw createError({ statusCode: 400, message: 'Unknown sample user' })
  }
  const context = await auth.$context
  const session = await context.internalAdapter.createSession(identity.id, false, {
    activeOrganizationId: identity.organizationId
  })
  if (!session) {
    throw createError({ statusCode: 503, message: 'Demo session unavailable' })
  }
  const cookie = context.authCookies.sessionToken
  const signature = createHmac('sha256', context.secret).update(session.token).digest('base64')
  const value = `${session.token}.${signature}`
  setCookie(event, cookie.name, value, { ...cookie.attributes, sameSite: 'lax', maxAge: 86400 })
  setCookie(event, 'portal-demo-user', identity.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookie.attributes.secure,
    path: '/',
    maxAge: 86400 * 30
  })
  // Make the session available to handlers during this same request.
  const existing = (event.node.req.headers.cookie || '')
    .split(';')
    .filter((part) => part.trim().split('=')[0] !== cookie.name)
  existing.push(`${cookie.name}=${encodeURIComponent(value)}`)
  event.node.req.headers.cookie = existing.filter(Boolean).join('; ')
  event.headers.set('cookie', event.node.req.headers.cookie)
  // Sessions are visitor-specific; never change a shared user's global identity.
  return identity
}

export async function ensureDemoSession(event: H3Event) {
  const current = await auth.api.getSession({ headers: event.headers })
  if (current?.user && demoIdentities.some((user) => user.id === current.user.id)) {
    return
  }
  const selected = demoIdentities.find((user) => user.id === getCookie(event, 'portal-demo-user'))
  await createDemoSession(event, selected?.id || demoIdentities[0].id)
}

export async function removeDemoSession(event: H3Event) {
  const current = await auth.api.getSession({ headers: event.headers })
  if (current) {
    await pool.query('DELETE FROM public.session WHERE id = $1', [current.id])
  }
}
