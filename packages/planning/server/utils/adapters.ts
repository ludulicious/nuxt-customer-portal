import { pool } from '@nuxt-customer-portal/core/server/utils/db'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { baseUrl } from '@nuxt-customer-portal/products/server/utils/access'
import { encrypt, decrypt, digest } from './crypto'
import type { Interval } from '../../shared/types'
import { wallInstant } from '../../shared/availability'

export interface Credentials {
  access_token: string
  refresh_token: string
  expiresAt: number
}
export interface CalendarEvent {
  id: string
  summary: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  transparency: 'transparent' | 'opaque'
  extendedProperties: { private: Record<string, string> }
  recurrence?: string[]
  description?: string
}
export interface CalendarAdapter {
  calendars(
    storeId: string,
    userId: string
  ): Promise<Array<{ id: string; summary: string; accessRole: string; timeZone?: string }>>
  busy(storeId: string, userId: string, calendarIds: string[], from: Date, to: Date): Promise<Interval[]>
  put(
    storeId: string,
    userId: string,
    calendarId: string,
    event: CalendarEvent
  ): Promise<undefined | { id: string; externalChangeKey?: string; wasMissing: boolean }>
  remove(storeId: string, userId: string, calendarId: string, eventId: string): Promise<void>
  watch(
    storeId: string,
    userId: string,
    calendarId: string,
    id: string,
    token: string
  ): Promise<{ resourceId: string; expiration: string }>
}
export interface MeetingAdapter {
  ensure(
    storeId: string,
    userId: string,
    identity: string,
    title: string,
    start: Date,
    duration: number,
    details: { agenda: string; inviteeEmail: string },
    existingId?: string
  ): Promise<{ id: string; url: string }>
  remove(storeId: string, userId: string, id: string): Promise<void>
}
export function oauthConfig(provider: 'google' | 'zoom') {
  const prefix = `PLANNING_${provider.toUpperCase()}`
  const clientId = process.env[`${prefix}_CLIENT_ID`],
    clientSecret = process.env[`${prefix}_CLIENT_SECRET`]
  if (!clientId || !clientSecret) {
    throw new Error(`Configure ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET`)
  }
  return { clientId, clientSecret, redirectUri: `${baseUrl()}/api/planning/oauth/${provider}/callback` }
}
export async function exchange(provider: 'google' | 'zoom', params: Record<string, string>): Promise<Credentials> {
  const config = oauthConfig(provider)
  const response = await fetch(
    provider === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://zoom.us/oauth/token',
    {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(provider === 'zoom'
          ? { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}` }
          : {})
      },
      body: new URLSearchParams({
        ...params,
        redirect_uri: config.redirectUri,
        ...(provider === 'google' ? { client_id: config.clientId, client_secret: config.clientSecret } : {})
      })
    }
  )
  if (!response.ok) {
    throw new Error(`Calendar/meeting authorization failed (${response.status})`)
  }
  const value = (await response.json()) as { access_token: string; refresh_token?: string; expires_in: number }
  if (!value.access_token || !value.expires_in) {
    throw new Error('Invalid authorization response')
  }
  return {
    access_token: value.access_token,
    refresh_token: value.refresh_token || params.refresh_token || '',
    expiresAt: Date.now() + value.expires_in * 1000
  }
}
async function accessToken(storeId: string, userId: string, provider: 'google' | 'zoom') {
  const client = await pool.connect(),
    lock = `planning-token:${storeId}:${userId}:${provider}`
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [lock])
    const [connection] = await rows<{ credentials: string; healthy: boolean }>(
      'SELECT credentials,healthy FROM planning.connection WHERE store_id=$1 AND user_id=$2 AND provider=$3',
      [storeId, userId, provider],
      client
    )
    if (!connection?.healthy) {
      throw new Error(`Reconnect ${provider} before planning`)
    }
    let credentials = decrypt<Credentials>(connection.credentials)
    if (credentials.expiresAt < Date.now() + 60000) {
      credentials = await exchange(provider, { grant_type: 'refresh_token', refresh_token: credentials.refresh_token })
      await rows(
        'UPDATE planning.connection SET credentials=$4,error=NULL WHERE store_id=$1 AND user_id=$2 AND provider=$3',
        [storeId, userId, provider, encrypt(credentials)],
        client
      )
    }
    return credentials.access_token
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lock]).catch(() => undefined)
    client.release()
  }
}
async function api<T>(
  provider: 'google' | 'zoom',
  storeId: string,
  userId: string,
  path: string,
  method = 'GET',
  body?: unknown,
  allowed: number[] = []
): Promise<T> {
  const token = await accessToken(storeId, userId, provider)
  const response = await fetch(
    `${provider === 'google' ? 'https://www.googleapis.com/calendar/v3' : 'https://api.zoom.us/v2'}${path}`,
    {
      method,
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    }
  )
  if (!response.ok && !allowed.includes(response.status)) {
    if (response.status === 401) {
      await rows(
        'UPDATE planning.connection SET healthy=false,error=$4 WHERE store_id=$1 AND user_id=$2 AND provider=$3',
        [storeId, userId, provider, 'Authorization expired; reconnect']
      )
    }
    let detail = ''
    try {
      const payload = (await response.json()) as { error?: { message?: string }; message?: string }
      detail = String(payload.error?.message || payload.message || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500)
    } catch {
      // Some provider error responses have no JSON body.
    }
    throw new Error(`${provider} API failed (${response.status})${detail ? `: ${detail}` : ''}`)
  }
  if (response.status === 204 || allowed.includes(response.status)) {
    return undefined as T
  }
  return (await response.json()) as T
}
const calendarPath = (id: string) => `/calendars/${encodeURIComponent(id)}/events`
export const googleCalendar: CalendarAdapter = {
  async calendars(s, u) {
    const items: Awaited<ReturnType<CalendarAdapter['calendars']>> = []
    let pageToken: string | undefined
    do {
      const result: { items?: typeof items; nextPageToken?: string } = await api(
        'google',
        s,
        u,
        `/users/me/calendarList?${new URLSearchParams({ maxResults: '250', ...(pageToken ? { pageToken } : {}) })}`
      )
      items.push(...(result.items || []))
      pageToken = result.nextPageToken
    } while (pageToken)
    return items
  },
  async busy(s, u, ids, from, to) {
    if (!ids.length) {
      throw new Error('Select calendars for conflict checks')
    }
    const response = await api<{ calendars: Record<string, { busy: Interval[]; errors?: unknown[] }> }>(
      'google',
      s,
      u,
      '/freeBusy',
      'POST',
      { timeMin: from.toISOString(), timeMax: to.toISOString(), items: ids.map((id) => ({ id })) }
    )
    if (ids.some((id) => !response.calendars[id] || response.calendars[id]!.errors?.length)) {
      throw new Error('Calendar conflict check unavailable')
    }
    return ids.flatMap((id) => response.calendars[id]!.busy)
  },
  async put(s, u, id, event) {
    const existing = await api<(CalendarEvent & { updated?: string; status?: string }) | undefined>(
      'google',
      s,
      u,
      `${calendarPath(id)}/${event.id}`,
      'GET',
      undefined,
      [404, 410]
    )
    const instant = (value: string, zone: string) =>
      /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
        ? Date.parse(value)
        : wallInstant(value.slice(0, 10), value.slice(11, 16), zone).getTime()
    const same =
      !!existing &&
      existing.status !== 'cancelled' &&
      existing.summary === event.summary &&
      existing.start?.dateTime &&
      existing.end?.dateTime &&
      instant(existing.start.dateTime, existing.start.timeZone || event.start.timeZone) ===
        instant(event.start.dateTime, event.start.timeZone) &&
      instant(existing.end.dateTime, existing.end.timeZone || event.end.timeZone) ===
        instant(event.end.dateTime, event.end.timeZone) &&
      (existing.transparency || 'opaque') === event.transparency &&
      JSON.stringify(existing.recurrence || []) === JSON.stringify(event.recurrence || []) &&
      (existing.description || '') === (event.description || '')
    const sameRevision =
      existing?.extendedProperties?.private?.portalRevision === event.extendedProperties.private.portalRevision
    const externalChangeKey =
      existing && sameRevision && !same ? digest(existing.updated || JSON.stringify(existing)).slice(0, 16) : undefined
    if (same && sameRevision) {
      return { id: event.id, wasMissing: false }
    }
    if (existing && existing.status !== 'cancelled') {
      await api('google', s, u, `${calendarPath(id)}/${event.id}`, 'PUT', event)
      return { id: event.id, externalChangeKey, wasMissing: false }
    }
    // Deleted Google event IDs cannot always be reused. Recover with a deterministic replacement ID.
    for (let attempt = 0; attempt < 4; attempt++) {
      const eventId =
        attempt === 0
          ? event.id
          : `${event.id}r${digest(event.extendedProperties.private.portalRevision + ':' + attempt).slice(0, 8)}`
      const created = await api<{ id: string } | undefined>(
        'google',
        s,
        u,
        calendarPath(id),
        'POST',
        { ...event, id: eventId },
        [409]
      )
      if (created) {
        return { id: eventId, wasMissing: true }
      }
      const recovered = await api<{ id: string; status?: string } | undefined>(
        'google',
        s,
        u,
        `${calendarPath(id)}/${eventId}`,
        'GET',
        undefined,
        [404, 410]
      )
      if (recovered && recovered.status !== 'cancelled') {
        await api('google', s, u, `${calendarPath(id)}/${eventId}`, 'PUT', { ...event, id: eventId })
        return { id: eventId, wasMissing: false }
      }
    }
    throw new Error('Could not recreate the calendar event')
  },
  async remove(s, u, id, eventId) {
    await api('google', s, u, `${calendarPath(id)}/${eventId}`, 'DELETE', undefined, [404, 410])
  },
  watch: (s, u, id, channelId, token) =>
    api('google', s, u, `${calendarPath(id)}/watch`, 'POST', {
      id: channelId,
      type: 'web_hook',
      address: `${baseUrl()}/api/planning/google/notifications`,
      token
    })
}
/** Bounded event reads used for conflict alerts; no external event titles are persisted. */
export async function externalBusy(
  storeId: string,
  userId: string,
  calendarIds: string[],
  from: Date,
  to: Date
): Promise<Interval[]> {
  const busy: Interval[] = []
  for (const calendarId of calendarIds) {
    let pageToken: string | undefined
    do {
      const result: {
        items?: Array<{
          status?: string
          transparency?: string
          start: { dateTime?: string; date?: string }
          end: { dateTime?: string; date?: string }
          extendedProperties?: { private?: Record<string, string> }
        }>
        timeZone?: string
        nextPageToken?: string
      } = await api(
        'google',
        storeId,
        userId,
        `${calendarPath(calendarId)}?${new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', maxResults: '2500', ...(pageToken ? { pageToken } : {}) })}`
      )
      for (const e of result.items || []) {
        if (
          e.status === 'cancelled' ||
          e.transparency === 'transparent' ||
          e.extendedProperties?.private?.portalPlanning
        ) {
          continue
        }
        // All-day boundaries follow the connected calendar’s timezone, including DST.
        busy.push({
          start: e.start.dateTime || wallInstant(e.start.date!, '00:00', result.timeZone || 'UTC').toISOString(),
          end: e.end.dateTime || wallInstant(e.end.date!, '00:00', result.timeZone || 'UTC').toISOString()
        })
      }
      pageToken = result.nextPageToken
    } while (pageToken)
  }
  return busy
}
export async function externalBusyDetails(
  storeId: string,
  userId: string,
  calendarIds: string[],
  from: Date,
  to: Date
): Promise<Array<Interval & { title?: string; allDay?: boolean; startDate?: string; endDate?: string }>> {
  const events: Array<Interval & { title?: string; allDay?: boolean; startDate?: string; endDate?: string }> = []
  for (const calendarId of calendarIds) {
    try {
      let pageToken: string | undefined
      do {
        const result: {
          items?: Array<{
            summary?: string
            status?: string
            transparency?: string
            start: { dateTime?: string; date?: string }
            end: { dateTime?: string; date?: string }
            extendedProperties?: { private?: Record<string, string> }
          }>
          timeZone?: string
          nextPageToken?: string
        } = await api(
          'google',
          storeId,
          userId,
          `${calendarPath(calendarId)}?${new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', maxResults: '2500', fields: 'items(summary,status,transparency,start,end,extendedProperties),nextPageToken,timeZone', ...(pageToken ? { pageToken } : {}) })}`
        )
        for (const event of result.items || []) {
          if (
            event.status === 'cancelled' ||
            event.transparency === 'transparent' ||
            event.extendedProperties?.private?.portalPlanning
          ) {
            continue
          }
          events.push({
            start:
              event.start.dateTime || wallInstant(event.start.date!, '00:00', result.timeZone || 'UTC').toISOString(),
            end: event.end.dateTime || wallInstant(event.end.date!, '00:00', result.timeZone || 'UTC').toISOString(),
            title: event.summary?.trim() || undefined,
            allDay: Boolean(event.start.date && event.end.date),
            startDate: event.start.date,
            endDate: event.end.date
          })
        }
        pageToken = result.nextPageToken
      } while (pageToken)
    } catch {
      // Calendars shared as free/busy-only cannot expose titles, but still block time.
      events.push(...(await googleCalendar.busy(storeId, userId, [calendarId], from, to)))
    }
  }
  return events
}
export const zoomMeeting: MeetingAdapter = {
  async ensure(s, u, identity, title, start, duration, details, existingId) {
    const agenda = `${details.agenda}\n\nPortal reference: ${identity}`,
      settings = {
        waiting_room: true,
        join_before_host: false,
        meeting_invitees: [{ email: details.inviteeEmail }]
      },
      update = { topic: title, start_time: start.toISOString(), duration, timezone: 'UTC', agenda, settings }
    if (existingId) {
      const meeting = await api<
        | {
            id: number
            join_url: string
            topic: string
            start_time: string
            duration: number
            agenda: string
            settings?: {
              waiting_room?: boolean
              join_before_host?: boolean
              meeting_invitees?: Array<{ email?: string }>
            }
          }
        | undefined
      >('zoom', s, u, `/meetings/${encodeURIComponent(existingId)}`, 'GET', undefined, [404])
      if (meeting) {
        const invitee = details.inviteeEmail.toLowerCase()
        const unchanged =
          meeting.topic === title &&
          Date.parse(meeting.start_time) === start.getTime() &&
          meeting.duration === duration &&
          meeting.agenda === agenda &&
          meeting.settings?.waiting_room === true &&
          meeting.settings?.join_before_host === false &&
          meeting.settings.meeting_invitees?.some((item) => item.email?.toLowerCase() === invitee)
        if (!unchanged) {
          await api('zoom', s, u, `/meetings/${encodeURIComponent(existingId)}`, 'PATCH', update)
        }
        return { id: String(meeting.id), url: meeting.join_url }
      }
    }
    // Recover a successful create whose response was lost, before creating another meeting.
    let page: string | undefined
    do {
      const result: { meetings: Array<{ id: number; agenda?: string; join_url: string }>; next_page_token?: string } =
        await api(
          'zoom',
          s,
          u,
          `/users/me/meetings?${new URLSearchParams({ type: 'scheduled', page_size: '300', ...(page ? { next_page_token: page } : {}) })}`
        )
      const existing = result.meetings.find(
        (meeting) => meeting.agenda === identity || meeting.agenda?.endsWith(`Portal reference: ${identity}`)
      )
      if (existing) {
        await api('zoom', s, u, `/meetings/${existing.id}`, 'PATCH', update)
        return { id: String(existing.id), url: existing.join_url }
      }
      page = result.next_page_token
    } while (page)
    const value = await api<{ id: number; join_url: string }>('zoom', s, u, '/users/me/meetings', 'POST', {
      ...update,
      type: 2
    })
    return { id: String(value.id), url: value.join_url }
  },
  async remove(s, u, id) {
    await api('zoom', s, u, `/meetings/${encodeURIComponent(id)}`, 'DELETE', undefined, [404])
  }
}
let calendar: CalendarAdapter = googleCalendar,
  meeting: MeetingAdapter = zoomMeeting
export const calendarAdapter = () => calendar
export const meetingAdapter = () => meeting
export function registerPlanningAdapters(value: { calendar?: CalendarAdapter; meeting?: MeetingAdapter }) {
  calendar = value.calendar || calendar
  meeting = value.meeting || meeting
}
