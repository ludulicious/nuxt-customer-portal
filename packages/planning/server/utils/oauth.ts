import { getCookie, setCookie, deleteCookie, createError, type H3Event } from 'h3'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { providerAccess } from './access'
import { oauthConfig, exchange } from './adapters'
import { digest, secret, encrypt } from './crypto'

export function oauthProvider(value: string | undefined): 'google' | 'zoom' {
  if (value !== 'google' && value !== 'zoom') {
    throw createError({ statusCode: 404 })
  }
  return value
}
export async function startOAuth(event: H3Event, provider: 'google' | 'zoom') {
  const { storeId, userId } = await providerAccess(event),
    config = oauthConfig(provider),
    state = secret(),
    binding = secret()
  await rows(
    `INSERT INTO planning.oauth_state(id,store_id,user_id,provider,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 minutes')`,
    [digest(`${state}:${binding}`), storeId, userId, provider]
  )
  setCookie(event, 'planning-oauth', binding, {
    httpOnly: true,
    secure: config.redirectUri.startsWith('https://'),
    sameSite: 'lax',
    path: '/api/planning/oauth',
    maxAge: 600
  })
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state,
    ...(provider === 'google'
      ? {
          access_type: 'offline',
          prompt: 'consent',
          scope:
            'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.freebusy'
        }
      : {})
  })
  return {
    url: `${provider === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://zoom.us/oauth/authorize'}?${params}`
  }
}
export async function finishOAuth(event: H3Event, provider: 'google' | 'zoom', state: string, code: string) {
  const { storeId, userId } = await providerAccess(event),
    binding = getCookie(event, 'planning-oauth')
  if (!binding || !state || !code) {
    throw createError({ statusCode: 400, message: 'Authorization state missing' })
  }
  const [request] = await rows<{ id: string }>(
    'DELETE FROM planning.oauth_state WHERE id=$1 AND store_id=$2 AND user_id=$3 AND provider=$4 AND expires_at>now() RETURNING id',
    [digest(`${state}:${binding}`), storeId, userId, provider]
  )
  deleteCookie(event, 'planning-oauth', { path: '/api/planning/oauth' })
  if (!request) {
    throw createError({ statusCode: 403, message: 'Authorization expired or belongs to another user' })
  }
  const credentials = await exchange(provider, { grant_type: 'authorization_code', code })
  if (!credentials.refresh_token) {
    throw createError({ statusCode: 400, message: 'Offline authorization required; reconnect with consent' })
  }
  let externalId: string,
    externalLabel: string | null = null
  if (provider === 'google') {
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${credentials.access_token}` },
      signal: AbortSignal.timeout(15000)
    })
    if (!response.ok) {
      throw new Error('Could not identify connected account')
    }
    const profile = (await response.json()) as { sub?: string }
    if (!profile.sub) {
      throw new Error('Connected account identity missing')
    }
    externalId = profile.sub
  } else {
    const response = await fetch('https://api.zoom.us/v2/users/me', {
      headers: { Authorization: `Bearer ${credentials.access_token}` },
      signal: AbortSignal.timeout(15000)
    })
    if (!response.ok) {
      throw new Error('Could not identify connected Zoom account')
    }
    const profile = (await response.json()) as {
      id?: string
      email?: string
      first_name?: string
      last_name?: string
    }
    if (!profile.id) {
      throw new Error('Connected Zoom account identity missing')
    }
    externalId = profile.id
    externalLabel = profile.email || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.id
  }
  await rows(
    'INSERT INTO planning.connection(store_id,user_id,provider,credentials,external_user_id,external_user_label) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(store_id,user_id,provider) DO UPDATE SET credentials=$4,external_user_id=$5,external_user_label=$6,healthy=true,error=NULL',
    [storeId, userId, provider, encrypt(credentials), externalId, externalLabel]
  )
}
