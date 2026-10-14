import { sql, type SQL } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { assertTimeEntriesReopenable } from '@nuxt-customer-portal/core/server/utils/business-hooks'
import { clientReviewPeriods, nextReviewMonth, type ClientReviewInterval } from '../../shared/client-review-periods'
import type {
  ClientReviewPeriodDto,
  ClientReviewRequestDto,
  ReviewEntrySnapshot
} from '../../shared/types/client-review-request'
import { notifyReviewRequest } from './client-review-request-email'

type Executor = Pick<typeof db, 'execute'>
export const reviewRows = async <T>(executor: Executor, query: SQL): Promise<T[]> =>
  (await executor.execute(query)).rows as T[]
const fail = (message: string, statusCode = 409): never => {
  throw createError({ statusCode, message })
}
const lockClient = async (tx: Executor, workspaceId: string, clientId: string) => {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'client-review:' + workspaceId + ':' + clientId}))`)
}
export const reviewToday = async (executor: Executor, workspaceId: string) => {
  const [row] = await reviewRows<{ today: string }>(
    executor,
    sql`
    select (current_timestamp at time zone coalesce((select timezone from timesheets.workspace_settings where organization_id = ${workspaceId}), 'Europe/Amsterdam'))::date::text as today`
  )
  return row!.today
}
export const reviewCutover = async (executor: Executor = db) => {
  const [row] = await reviewRows<{ startsOn: string }>(
    executor,
    sql`select starts_on::text as "startsOn" from timesheets.client_review_rollout`
  )
  return row!.startsOn
}
export const isLegacyReviewEntry = sql`time_entry.entry_date < (select starts_on from timesheets.client_review_rollout)`

export const getReviewInterval = async (executor: Executor, linkId: string, date: string) => {
  const [row] = await reviewRows<{ interval: ClientReviewInterval }>(
    executor,
    sql`
    select interval from timesheets.client_review_schedule where workspace_client_id = ${linkId} and effective_on <= ${date}::date order by effective_on desc limit 1`
  )
  return row?.interval ?? 'WEEKLY'
}
export const getClientReviewSettings = async (workspaceId: string, clientId: string) => {
  const today = await reviewToday(db, workspaceId)
  const [link] = await reviewRows<{ id: string }>(
    db,
    sql`select id from timesheets.workspace_client where workspace_organization_id = ${workspaceId} and client_organization_id = ${clientId}`
  )
  if (!link) {
    return {
      reviewInterval: 'WEEKLY' as ClientReviewInterval,
      scheduledReviewInterval: null,
      reviewIntervalEffectiveOn: null,
      reviewStartsOn: await reviewCutover()
    }
  }
  const [scheduled] = await reviewRows<{ interval: ClientReviewInterval; effectiveOn: string }>(
    db,
    sql`
    select interval, effective_on::text as "effectiveOn" from timesheets.client_review_schedule where workspace_client_id = ${link.id} and effective_on > ${today}::date order by effective_on limit 1`
  )
  return {
    reviewInterval: await getReviewInterval(db, link.id, today),
    scheduledReviewInterval: scheduled?.interval ?? null,
    reviewIntervalEffectiveOn: scheduled?.effectiveOn ?? null,
    reviewStartsOn: await reviewCutover()
  }
}
export const saveClientReviewSettings = async (
  workspaceId: string,
  clientId: string,
  input: { reviewInterval?: ClientReviewInterval; accessMode?: 'DISABLED' | 'VIEW' | 'REVIEW' }
) => {
  await db.transaction(async (tx) => {
    await lockClient(tx, workspaceId, clientId)
    const [link] = await reviewRows<{ id: string }>(
      tx,
      sql`select id from timesheets.workspace_client where workspace_organization_id = ${workspaceId} and client_organization_id = ${clientId}`
    )
    if (!link) {
      fail('Client relationship not found', 404)
    }
    if (input.reviewInterval) {
      const effectiveOn = nextReviewMonth(await reviewToday(tx, workspaceId))
      await tx.execute(
        sql`insert into timesheets.client_review_schedule (workspace_client_id, effective_on, interval) values (${link!.id}, ${effectiveOn}, ${input.reviewInterval}) on conflict (workspace_client_id, effective_on) do update set interval = excluded.interval`
      )
    }
    if (input.accessMode) {
      await tx.execute(
        sql`update timesheets.workspace_client set access_mode = ${input.accessMode}, updated_at = now() where id = ${link!.id}`
      )
    }
  })
}
export const scheduleClientReviewInterval = (workspaceId: string, clientId: string, interval: ClientReviewInterval) =>
  saveClientReviewSettings(workspaceId, clientId, { reviewInterval: interval })

const periodEntries = async (executor: Executor, workspaceId: string, clientId: string, from: string, to: string) =>
  reviewRows<{
    id: string
    status: string | null
    timer: string | null
    covered: boolean
    snapshot: ReviewEntrySnapshot
  }>(
    executor,
    sql`
    select e.id, s.status, e.timer_started_at as timer,
      exists (select 1 from timesheets.client_review_request_entry re join timesheets.client_review_request r on r.id = re.request_id where re.entry_id = e.id and r.status <> 'WITHDRAWN') as covered,
      jsonb_build_object('id', e.id, 'date', e.entry_date::text, 'weekStartsOn', (e.entry_date - ((extract(dow from e.entry_date)::integer - coalesce((select week_starts_on from timesheets.workspace_settings where organization_id = e.organization_id), 1) + 7) % 7))::text, 'personId', e.user_id, 'person', u.name, 'project', p.name,
        'activity', a.name, 'minutes', e.duration_minutes, 'note', e.note, 'billable', e.billable_snapshot,
        'rate', e.hourly_rate_minor_snapshot, 'currency', e.currency_snapshot, 'submissionId', e.submission_id) as snapshot
    from timesheets.time_entry e left join timesheets.submission s on s.id = e.submission_id
    join public."user" u on u.id = e.user_id join timesheets.project p on p.id = e.project_id
    join timesheets.activity_type a on a.id = e.activity_type_id
    where e.organization_id = ${workspaceId} and e.client_organization_id = ${clientId} and e.entry_date between ${from}::date and ${to}::date
    order by e.entry_date, u.name, p.name, e.id`
  )

export const eligibleReviewers = async (executor: Executor, linkId: string) =>
  reviewRows<{ id: string; name: string; email: string }>(
    executor,
    sql`
  select distinct u.id, u.name, u.email from timesheets.workspace_client_reviewer r
  join timesheets.workspace_client c on c.id = r.workspace_client_id
  join public.member m on m.organization_id = c.client_organization_id and m.user_id = r.user_id
  join public."user" u on u.id = m.user_id where r.workspace_client_id = ${linkId}`
  )

export const listReviewPeriods = async (workspaceId: string, month: string): Promise<ClientReviewPeriodDto[]> => {
  const links = await reviewRows<{ id: string; clientId: string; name: string; weekStartsOn: number }>(
    db,
    sql`
    select c.id, c.client_organization_id as "clientId", o.name, coalesce(w.week_starts_on, 1) as "weekStartsOn"
    from timesheets.workspace_client c join public.organization o on o.id = c.client_organization_id
    left join timesheets.workspace_settings w on w.organization_id = c.workspace_organization_id
    where c.workspace_organization_id = ${workspaceId} and c.access_mode = 'REVIEW'`
  )
  const cutover = await reviewCutover()
  const today = await reviewToday(db, workspaceId)
  const result: ClientReviewPeriodDto[] = []
  for (const link of links) {
    const interval = await getReviewInterval(db, link.id, `${month}-01`)
    const reviewers = await eligibleReviewers(db, link.id)
    for (const period of clientReviewPeriods(month, interval, link.weekStartsOn)) {
      if (period.startsOn < cutover) {
        continue
      }
      const entries = await periodEntries(db, workspaceId, link.clientId, period.startsOn, period.endsOn)
      const available = entries.filter((e) => !e.covered)
      const outstandingCount = entries.filter((e) => e.status !== 'APPROVED' || e.timer !== null).length
      result.push({
        workspaceClientId: link.id,
        clientName: link.name,
        ...period,
        interval,
        totalMinutes: available.reduce((sum, e) => sum + e.snapshot.minutes, 0),
        availableCount: available.length,
        outstandingCount,
        outstandingEntries: entries
          .filter((e) => e.status !== 'APPROVED' || e.timer !== null)
          .map((e) => ({ id: e.id, date: e.snapshot.date, person: e.snapshot.person })),
        hasReviewers: reviewers.length > 0,
        canSend: period.endsOn < today && available.length > 0 && !outstandingCount && reviewers.length > 0
      })
    }
  }
  return result
}

export const listReviewRequests = async (
  organizationId: string,
  userId: string,
  clientSide: boolean,
  isAdmin: boolean
): Promise<ClientReviewRequestDto[]> => {
  const requests = await reviewRows<Omit<ClientReviewRequestDto, 'entries' | 'history'>>(
    db,
    sql`
    select r.id, r.workspace_client_id as "workspaceClientId", c.name as "clientName", p.name as "supplierName",
      r.starts_on::text as "startsOn", r.ends_on::text as "endsOn", r.revision, r.status, r.version, r.supplementary,
      r.replaces_id as "replacesId", coalesce((select jsonb_agg(replaces_id order by replaces_id) from timesheets.client_review_request_replacement where request_id = r.id), '[]'::jsonb) as "replacesIds", r.message
    from timesheets.client_review_request r join timesheets.workspace_client wc on wc.id = r.workspace_client_id
    join public.organization c on c.id = wc.client_organization_id join public.organization p on p.id = wc.workspace_organization_id
    where ${clientSide ? sql`wc.client_organization_id = ${organizationId} and wc.access_mode = 'REVIEW' and (${isAdmin} or exists (select 1 from timesheets.workspace_client_reviewer a where a.workspace_client_id = wc.id and a.user_id = ${userId}))` : sql`wc.workspace_organization_id = ${organizationId}`}
    order by r.starts_on desc, c.name, r.revision desc`
  )
  return Promise.all(
    requests.map(async (request) => ({
      ...request,
      entries: (
        await reviewRows<{ snapshot: ClientReviewRequestDto['entries'][number] }>(
          db,
          sql`select ${clientSide ? sql`snapshot - 'rate' - 'currency' - 'billable'` : sql`snapshot`} as snapshot from timesheets.client_review_request_entry where request_id = ${request.id} order by snapshot->>'date', snapshot->>'person', entry_id`
        )
      ).map((e) => e.snapshot),
      history: await reviewRows<ClientReviewRequestDto['history'][number]>(
        db,
        sql`select e.action, u.name as actor, e.actor_id as "actorId", e.comment, e.created_at::text as "createdAt" from timesheets.client_review_request_event e join public."user" u on u.id = e.actor_id where request_id = ${request.id} order by e.created_at, e.id`
      )
    }))
  )
}

export const sendReviewRequest = async (
  workspaceId: string,
  actorId: string,
  linkId: string,
  startsOn: string,
  endsOn: string,
  message?: string
) => {
  const id = await db.transaction(async (tx) => {
    const [link] = await reviewRows<{ clientId: string; weekStartsOn: number }>(
      tx,
      sql`
      select c.client_organization_id as "clientId", coalesce(w.week_starts_on, 1) as "weekStartsOn" from timesheets.workspace_client c
      left join timesheets.workspace_settings w on w.organization_id = c.workspace_organization_id
      where c.id = ${linkId} and c.workspace_organization_id = ${workspaceId} and c.access_mode = 'REVIEW'`
    )
    if (!link) {
      fail('Review-enabled client relationship not found', 404)
    }
    await lockClient(tx, workspaceId, link!.clientId)
    const [currentLink] = await reviewRows<{ id: string }>(
      tx,
      sql`select id from timesheets.workspace_client where id = ${linkId} and access_mode = 'REVIEW'`
    )
    if (!currentLink) {
      fail('Client review access changed; refresh and try again')
    }
    const interval = await getReviewInterval(tx, linkId, startsOn)
    if (
      !clientReviewPeriods(startsOn, interval, link!.weekStartsOn).some(
        (p) => p.startsOn === startsOn && p.endsOn === endsOn
      )
    ) {
      fail('Invalid review period', 422)
    }
    if (startsOn < (await reviewCutover(tx)) || endsOn >= (await reviewToday(tx, workspaceId))) {
      fail('Review period has not ended')
    }
    const entries = await periodEntries(tx, workspaceId, link!.clientId, startsOn, endsOn)
    if (entries.some((e) => e.status !== 'APPROVED' || e.timer !== null)) {
      fail('Resolve outstanding time before sending')
    }
    const available = entries.filter((e) => !e.covered)
    if (!available.length) {
      fail('No unrequested time in this period')
    }
    if (!(await eligibleReviewers(tx, linkId)).length) {
      fail('Assign an eligible client reviewer before sending')
    }
    await assertTimeEntriesReopenable(
      workspaceId,
      available.map((e) => e.id)
    )
    const previous = await reviewRows<{ id: string; status: string; revision: number; replaced: boolean }>(
      tx,
      sql`
      select id, status, revision, exists (select 1 from timesheets.client_review_request_replacement replacement where replacement.replaces_id = r.id) as replaced from timesheets.client_review_request r where workspace_client_id = ${linkId} and starts_on = ${startsOn} and ends_on = ${endsOn} order by revision desc`
    )
    const withdrawn = previous.filter((r) => r.status === 'WITHDRAWN' && !r.replaced)
    const requestId = nanoid()
    await tx.execute(sql`insert into timesheets.client_review_request (id, workspace_client_id, starts_on, ends_on, revision, supplementary, replaces_id, sent_by_id, message)
      values (${requestId}, ${linkId}, ${startsOn}, ${endsOn}, ${(previous[0]?.revision ?? 0) + 1}, ${entries.some((e) => e.covered)}, ${withdrawn[0]?.id ?? null}, ${actorId}, ${message?.trim() || null})`)
    for (const predecessor of withdrawn) {
      await tx.execute(
        sql`insert into timesheets.client_review_request_replacement (request_id, replaces_id) values (${requestId}, ${predecessor.id})`
      )
    }
    for (const entry of available) {
      await tx.execute(
        sql`insert into timesheets.client_review_request_entry (request_id, entry_id, snapshot) values (${requestId}, ${entry.id}, ${JSON.stringify(entry.snapshot)}::jsonb)`
      )
    }
    await tx.execute(
      sql`insert into timesheets.client_review_request_event (id, request_id, action, actor_id, comment) values (${nanoid()}, ${requestId}, 'SENT', ${actorId}, ${message?.trim() || null})`
    )
    return requestId
  })
  await notifyReviewRequest(id, 'SENT')
  return { id }
}

export const actOnReviewRequest = async (
  organizationId: string,
  actorId: string,
  isAdmin: boolean,
  id: string,
  version: number,
  action: 'APPROVE' | 'DISPUTE' | 'WITHDRAW',
  comment?: string
) => {
  const status = action === 'APPROVE' ? 'APPROVED' : action === 'DISPUTE' ? 'DISPUTED' : 'WITHDRAWN'
  await db.transaction(async (tx) => {
    const [request] = await reviewRows<{ workspaceId: string; clientId: string; linkId: string }>(
      tx,
      sql`
      select wc.workspace_organization_id as "workspaceId", wc.client_organization_id as "clientId", wc.id as "linkId"
      from timesheets.client_review_request r join timesheets.workspace_client wc on wc.id = r.workspace_client_id where r.id = ${id}`
    )
    if (!request) {
      fail('Review request not found', 404)
    }
    await lockClient(tx, request!.workspaceId, request!.clientId)
    if (action === 'WITHDRAW') {
      if (request!.workspaceId !== organizationId || !isAdmin) {
        fail('Workspace administrator access required', 403)
      }
      const entries = await reviewRows<{ id: string }>(
        tx,
        sql`select entry_id as id from timesheets.client_review_request_entry where request_id = ${id}`
      )
      await assertTimeEntriesReopenable(
        organizationId,
        entries.map((e) => e.id)
      )
    } else {
      if (request!.clientId !== organizationId) {
        fail('Client review access required', 403)
      }
      const [access] = await reviewRows<{ id: string }>(
        tx,
        sql`select wc.id from timesheets.workspace_client wc where wc.id = ${request!.linkId} and wc.access_mode = 'REVIEW' and (${isAdmin} or exists (select 1 from timesheets.workspace_client_reviewer a where a.workspace_client_id = wc.id and a.user_id = ${actorId}))`
      )
      if (!access) {
        fail('Client reviewer access required', 403)
      }
      if (action === 'DISPUTE' && !comment?.trim()) {
        fail('A dispute comment is required', 422)
      }
    }
    const updated = await reviewRows<{ id: string }>(
      tx,
      sql`update timesheets.client_review_request set status = ${status}, version = version + 1 where id = ${id} and version = ${version} and ${action === 'WITHDRAW' ? sql`status <> 'WITHDRAWN'` : sql`status = 'PENDING'`} returning id`
    )
    if (!updated.length) {
      fail('Review request changed; refresh and try again')
    }
    await tx.execute(
      sql`insert into timesheets.client_review_request_event (id, request_id, action, actor_id, comment) values (${nanoid()}, ${id}, ${status}, ${actorId}, ${comment?.trim() || null})`
    )
  })
  await notifyReviewRequest(id, status)
  return { success: true }
}

export const assertNoActiveReviewRequests = async (executor: Executor, entryIds: string[]) => {
  if (!entryIds.length) {
    return
  }
  const affected = await reviewRows<{ id: string; clientName: string; startsOn: string; endsOn: string }>(
    executor,
    sql`
    select distinct r.id, o.name as "clientName", r.starts_on::text as "startsOn", r.ends_on::text as "endsOn"
    from timesheets.client_review_request_entry e join timesheets.client_review_request r on r.id = e.request_id
    join timesheets.workspace_client wc on wc.id = r.workspace_client_id join public.organization o on o.id = wc.client_organization_id
    where e.entry_id in (${sql.join(
      entryIds.map((id) => sql`${id}`),
      sql`, `
    )}) and r.status <> 'WITHDRAWN'`
  )
  if (affected.length) {
    throw createError({
      statusCode: 409,
      message: 'Withdraw affected client review requests before reopening this submission',
      data: { code: 'CLIENT_REVIEW_WITHDRAWAL_REQUIRED', requests: affected }
    })
  }
}
