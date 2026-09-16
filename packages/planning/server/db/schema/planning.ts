import {
  pgSchema,
  text,
  uuid,
  boolean,
  integer,
  timestamp,
  jsonb,
  primaryKey,
  foreignKey,
  index,
  check,
  type AnyPgColumn
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { organization, user } from '@nuxt-customer-portal/core/schema'
import { product, orders, orderLine } from '@nuxt-customer-portal/products/schema'
import type { AppointmentSnapshot, AvailabilityWindow, PlanningPolicy } from '../../../shared/types'

const schema = pgSchema('planning')
const instant = (name: string) => timestamp(name, { withTimezone: true })
export const settings = schema.table('settings', {
  storeId: text('store_id')
    .primaryKey()
    .references(() => organization.id),
  policy: jsonb('policy').$type<PlanningPolicy>().notNull()
})
export const provider = schema.table(
  'provider',
  {
    storeId: text('store_id')
      .notNull()
      .references(() => organization.id),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    enabled: boolean('enabled').notNull().default(false),
    timezone: text('timezone').notNull().default('Europe/Amsterdam'),
    graceMinutes: integer('grace_minutes').notNull().default(0),
    availabilityCalendarTitle: text('availability_calendar_title').notNull().default('Portal availability'),
    busyCalendarIds: text('busy_calendar_ids')
      .array()
      .notNull()
      .default(sql`'{}'`),
    writeCalendarId: text('write_calendar_id')
  },
  (t) => [
    primaryKey({ columns: [t.storeId, t.userId] }),
    check('provider_grace_minutes_check', sql`${t.graceMinutes} BETWEEN 0 AND 1440`)
  ]
)
const providerFk = (t: { storeId: AnyPgColumn; userId: AnyPgColumn }) =>
  foreignKey({ columns: [t.storeId, t.userId], foreignColumns: [provider.storeId, provider.userId] })
export const connection = schema.table(
  'connection',
  {
    storeId: text('store_id').notNull(),
    userId: text('user_id').notNull(),
    provider: text('provider').notNull(),
    credentials: text('credentials').notNull(),
    externalUserId: text('external_user_id').notNull(),
    healthy: boolean('healthy').notNull().default(true),
    error: text('error')
  },
  (t) => [
    primaryKey({ columns: [t.storeId, t.userId, t.provider] }),
    providerFk(t),
    check('connection_provider_check', sql`${t.provider} IN ('google','zoom')`)
  ]
)
export const oauthState = schema.table(
  'oauth_state',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id').notNull(),
    userId: text('user_id').notNull(),
    provider: text('provider').notNull(),
    expiresAt: instant('expires_at').notNull()
  },
  (t) => [providerFk(t)]
)
export const availability = schema.table(
  'availability',
  {
    id: uuid('id').primaryKey(),
    storeId: text('store_id').notNull(),
    userId: text('user_id').notNull(),
    data: jsonb('data').$type<AvailabilityWindow>().notNull(),
    revision: integer('revision').notNull().default(1),
    deleted: boolean('deleted').notNull().default(false),
    calendarEventId: text('calendar_event_id'),
    calendarId: text('calendar_id')
  },
  (t) => [providerFk(t)]
)
export const reservation = schema.table(
  'reservation',
  {
    id: uuid('id').primaryKey(),
    storeId: text('store_id').notNull(),
    userId: text('user_id').notNull(),
    productId: text('product_id')
      .notNull()
      .references(() => product.id),
    tokenHash: text('token_hash').notNull().unique(),
    startAt: instant('start_at').notNull(),
    endAt: instant('end_at').notNull(),
    blockedUntil: instant('blocked_until').notNull(),
    expiresAt: instant('expires_at').notNull(),
    confirmedAt: instant('confirmed_at'),
    status: text('status').notNull(),
    orderId: text('order_id')
      .unique()
      .references(() => orders.id),
    replacesId: uuid('replaces_id'),
    snapshot: jsonb('snapshot').$type<AppointmentSnapshot>().notNull()
  },
  (t) => [
    providerFk(t),
    foreignKey({ columns: [t.replacesId], foreignColumns: [appointment.id as AnyPgColumn] }),
    check('reservation_status_check', sql`${t.status} IN ('reserved','confirmed','expired','cancelled','superseded')`),
    check('reservation_check', sql`${t.startAt} < ${t.endAt} AND ${t.endAt} <= ${t.blockedUntil}`),
    index('reservation_expiry')
      .on(t.expiresAt)
      .where(sql`${t.status}='reserved'`)
  ]
)
// The provider/time exclusion constraint is installed by SQL migration (Drizzle has no exclusion builder).
export const appointment = schema.table(
  'appointment',
  {
    id: uuid('id').primaryKey(),
    storeId: text('store_id').notNull(),
    reservationId: uuid('reservation_id')
      .notNull()
      .unique()
      .references((): AnyPgColumn => reservation.id),
    orderLineId: text('order_line_id')
      .notNull()
      .unique()
      .references(() => orderLine.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    productId: text('product_id')
      .notNull()
      .references(() => product.id),
    startAt: instant('start_at').notNull(),
    endAt: instant('end_at').notNull(),
    status: text('status').notNull(),
    changes: integer('changes').notNull().default(0),
    revision: integer('revision').notNull().default(1),
    snapshot: jsonb('snapshot').$type<AppointmentSnapshot>().notNull(),
    meetingId: text('meeting_id'),
    meetingUrl: text('meeting_url'),
    calendarEventId: text('calendar_event_id'),
    calendarId: text('calendar_id'),
    calendarUserId: text('calendar_user_id'),
    conflict: boolean('conflict').notNull().default(false),
    effectsError: text('effects_error')
  },
  (t) => [check('appointment_status_check', sql`${t.status} IN ('confirmed','cancelled')`)]
)
export const audit = schema.table('audit', {
  id: uuid('id').primaryKey(),
  appointmentId: uuid('appointment_id')
    .notNull()
    .references(() => appointment.id),
  actorId: text('actor_id').references(() => user.id),
  action: text('action').notNull(),
  data: jsonb('data').notNull().default({}),
  createdAt: instant('created_at').notNull().defaultNow()
})
export const job = schema.table(
  'job',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').notNull(),
    attempts: integer('attempts').notNull().default(0),
    availableAt: instant('available_at').notNull().defaultNow(),
    completedAt: instant('completed_at'),
    error: text('error')
  },
  (t) => [
    index('job_pending')
      .on(t.availableAt)
      .where(sql`${t.completedAt} IS NULL`)
  ]
)
export const watch = schema.table(
  'watch',
  {
    id: uuid('id').primaryKey(),
    storeId: text('store_id').notNull(),
    userId: text('user_id').notNull(),
    calendarId: text('calendar_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    resourceId: text('resource_id'),
    expiresAt: instant('expires_at').notNull()
  },
  (t) => [providerFk(t)]
)
