import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { emailRecipientName } from '../../core/shared/email-recipient'
import * as emailDefinitions from '../shared/emails'
import type { Appointment } from '../shared/types'
import type { Order } from '../../products/shared/types'

const require = createRequire(import.meta.url)
function source(file: string) {
  return ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
}
const notificationSource = source('../server/utils/host-notifications.ts')
const jobSource = source('../server/utils/jobs.ts')

type SentEmail = {
  to: string
  definition: { id: string }
  locale: string
  values: Record<string, string>
  subjectPrefix?: string
  idempotencyKey: string
  attachments?: unknown[]
}

function harness() {
  const emails: SentEmail[] = []
  const queries: Array<{ sql: string; params: unknown[] }> = []
  const appointment = {
    id: 'appointment-one',
    order_id: 'order-one',
    user_id: 'host',
    store_id: 'store',
    revision: 1,
    status: 'confirmed',
    start_at: new Date('2026-11-02T09:00:00Z'),
    end_at: new Date('2026-11-02T10:00:00Z'),
    meeting_url: 'https://example.test/meeting',
    snapshot: {
      title: 'Consultation',
      locale: 'en',
      timezone: 'Europe/Amsterdam',
      customerTimezone: 'America/New_York',
      durationMinutes: 60,
      meetingProvider: 'none'
    }
  } as Appointment
  const order = {
    id: 'order-one',
    booking_reference: 'BK-123',
    email: 'customer@example.test',
    snapshot: { billing: { name: 'Sam Customer', firstName: 'Sam' }, locale: 'en', storeMode: 'live' },
    lines: [{ snapshot: { product: { nextSteps: { en: '', nl: '' } } } }]
  } as Order
  let locale = 'en',
    kind = 'appointment',
    failHost = false,
    development = false,
    hostExists = true,
    revision = 1
  const database = {
    rows: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params })
      if (sql.startsWith('WITH scoped')) {
        return [{ id: 'job-one', kind, payload: { appointmentId: appointment.id, revision }, attempts: 0 }]
      }
      if (sql.startsWith('SELECT completed_at')) {
        return [{ completed_at: null }]
      }
      if (sql.startsWith('SELECT * FROM planning.appointment')) {
        return [structuredClone(appointment)]
      }
      if (sql.startsWith('SELECT p.write_calendar_id')) {
        return [{ write_calendar_id: 'calendar', email: 'host@example.test' }]
      }
      if (sql.startsWith('SELECT u.email')) {
        return hostExists ? [{ email: 'host@example.test', first_name: 'Alex', name: 'Alex Host' }] : []
      }
      if (sql.includes("'{customerNotificationRevision}'")) {
        appointment.snapshot.customerNotificationRevision = Number(params[1])
      }
      if (sql.includes("'{hostNotificationRevision}'")) {
        appointment.snapshot.hostNotificationRevision = Number(params[1])
      }
      return []
    }
  }
  const notifications = {} as typeof import('../server/utils/host-notifications')
  const jobs = {} as typeof import('../server/utils/jobs')
  function mockedRequire(id: string): unknown {
    if (id.endsWith('/utils/db')) {
      return {
        pool: { connect: async () => ({ query: async () => ({ rows: [{ locked: true }] }), release: () => {} }) }
      }
    }
    if (id.endsWith('/portal-email')) {
      return {
        sendPortalEmail: async (email: SentEmail) => {
          if (failHost && email.to === 'host@example.test') {
            throw new Error('Host delivery failed')
          }
          emails.push(email)
        }
      }
    }
    if (id.endsWith('/email-recipient')) {
      return { emailRecipientName }
    }
    if (id.endsWith('/emails')) {
      return emailDefinitions
    }
    if (id.endsWith('/access')) {
      return { baseUrl: () => 'http://localhost:3059', getStore: async () => ({ default_locale: locale }) }
    }
    if (id.endsWith('/database')) {
      return database
    }
    if (id.endsWith('/development')) {
      return { developmentSandboxEffectsEnabled: () => development }
    }
    if (id.endsWith('/host-notifications')) {
      return notifications
    }
    if (id.endsWith('/orders')) {
      return { getOrder: async () => order, notifyOrder: async () => {} }
    }
    if (id.endsWith('/downloads')) {
      return {
        purchaseDownloads: async () => [],
        orderDownloadToken: async () => 'private-token',
        downloadEmailMarkdown: () => ''
      }
    }
    if (id.endsWith('/purchase-media')) {
      return { publicOrderPath: () => '/store/orders/private-token' }
    }
    if (id.endsWith('/invitation')) {
      return { calendarInvitation: () => 'ICS' }
    }
    if (id.endsWith('/appointment-calendar')) {
      return { appointmentCalendarTitle: () => 'Consultation', appointmentCalendarDescription: () => 'Details' }
    }
    if (id.endsWith('/adapters')) {
      return { calendarAdapter: () => ({ put: async () => ({ id: 'event' }), remove: async () => {} }) }
    }
    if (id.startsWith('.') || id.startsWith('@nuxt-customer-portal/')) {
      return {}
    }
    return require(id)
  }
  runInNewContext(notificationSource, { exports: notifications, require: mockedRequire })
  runInNewContext(jobSource, { exports: jobs, require: mockedRequire, Buffer })
  return {
    emails,
    queries,
    appointment,
    order,
    ...notifications,
    runJobs: jobs.runJobs,
    setLocale: (value: string) => {
      locale = value
    },
    setKind: (value: string) => {
      kind = value
    },
    setRevision: (value: number) => {
      revision = value
      appointment.revision = value
    },
    failHost: (value: boolean) => {
      failHost = value
    },
    removeHost: () => {
      hostExists = false
    },
    enableDevelopment: () => {
      development = true
    }
  }
}

test('booking jobs email the assigned host separately, in the scheduling timezone', async () => {
  const fixture = harness()
  const result = await fixture.runJobs()
  assert.equal(result.completed, 1)
  assert.equal(result.failed, 0)
  assert.equal(fixture.emails.length, 2)
  const hostEmail = fixture.emails[1]!
  assert.equal(hostEmail.definition.id, 'appointment-host')
  assert.equal(hostEmail.to, 'host@example.test')
  assert.equal(hostEmail.values.recipient_name, 'Alex')
  assert.equal(hostEmail.values.customer_email, 'customer@example.test')
  assert.equal(hostEmail.values.status, 'New appointment booked')
  assert.equal(hostEmail.values.timezone, 'Europe/Amsterdam')
  assert.match(hostEmail.values.time, /10:00/)
  assert.equal(hostEmail.values.url, 'http://localhost:3059/appointments')
  assert.match(hostEmail.values.meetingDetails, /https:\/\/example.test\/meeting/)
  assert.equal(hostEmail.attachments, undefined)
  assert.equal(JSON.stringify(hostEmail).includes('private-token'), false)
  assert.equal(fixture.appointment.snapshot.hostNotificationRevision, 1)
  await fixture.runJobs()
  assert.equal(fixture.emails.length, 2)
})

test('failed host delivery retries without resending the customer email', async () => {
  const fixture = harness()
  fixture.failHost(true)
  assert.equal((await fixture.runJobs()).failed, 1)
  assert.equal(fixture.appointment.snapshot.customerNotificationRevision, 1)
  assert.equal(fixture.appointment.snapshot.hostNotificationRevision, undefined)
  fixture.failHost(false)
  assert.equal((await fixture.runJobs()).completed, 1)
  assert.deepEqual(
    fixture.emails.map((email) => email.to),
    ['customer@example.test', 'host@example.test']
  )
})

test('reschedules and cancellations send distinct revision-keyed notifications in the store language', async () => {
  const fixture = harness()
  fixture.setLocale('nl')
  await fixture.runJobs()
  fixture.setRevision(2)
  await fixture.runJobs()
  assert.equal(fixture.emails[3]!.values.status, 'Afspraak bijgewerkt')
  fixture.setRevision(3)
  fixture.appointment.status = 'cancelled'
  await fixture.runJobs()
  const canceled = fixture.emails[5]!
  assert.equal(canceled.locale, 'nl')
  assert.equal(canceled.values.status, 'Afspraak geannuleerd')
  assert.equal(canceled.values.meetingDetails, '')
  assert.notEqual(canceled.idempotencyKey, fixture.emails[3]!.idempotencyKey)
})

test('silent calendar repairs do not notify the host or backfill old appointments', async () => {
  const fixture = harness()
  fixture.setKind('repair')
  assert.equal((await fixture.runJobs()).completed, 1)
  assert.equal(fixture.emails.length, 0)
})

test('sandbox host notifications require development effects and include the test prefix', async () => {
  const fixture = harness()
  fixture.order.snapshot.storeMode = 'sandbox'
  await fixture.notifyAppointmentHost(fixture.appointment, fixture.order)
  assert.equal(fixture.emails.length, 0)
  fixture.enableDevelopment()
  await fixture.notifyAppointmentHost(fixture.appointment, fixture.order)
  assert.equal(fixture.emails[0]!.subjectPrefix, '[TEST] ')
})

test('removed hosts cannot receive customer data and failed lookups do not record delivery', async () => {
  const fixture = harness()
  fixture.removeHost()
  await assert.rejects(fixture.notifyAppointmentHost(fixture.appointment, fixture.order), /no longer a store member/)
  assert.equal(fixture.emails.length, 0)
  assert.equal(fixture.appointment.snapshot.hostNotificationRevision, undefined)
  const lookup = fixture.queries.find(({ sql }) => sql.startsWith('SELECT u.email'))!
  assert.match(lookup.sql, /m.organization_id=\$2/)
  assert.deepEqual(Array.from(lookup.params), ['host', 'store'])
})

test('host messages use the customer name when no company name is provided', async () => {
  const fixture = harness()
  fixture.order.snapshot.billing.name = ''
  fixture.order.snapshot.billing.lastName = 'Customer'
  await fixture.notifyAppointmentHost(fixture.appointment, fixture.order)
  assert.equal(fixture.emails[0]!.values.customer_name, 'Sam Customer')
})
