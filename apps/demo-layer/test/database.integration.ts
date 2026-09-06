import assert from 'node:assert/strict'
import { demoPool, resetDemoIfDue } from '../server/utils/demo-reset'

// Run only against a disposable, migrated database ending in _demo.
try {
  await resetDemoIfDue()
  const counts = async () =>
    (
      await demoPool.query(`SELECT
    (SELECT count(*)::int FROM public."user") AS users,
    (SELECT count(*)::int FROM timesheets.time_entry) AS entries,
    (SELECT count(*)::int FROM invoices.invoice) AS invoices,
    (SELECT count(*)::int FROM service_requests.service_request) AS requests`)
    ).rows[0]
  const before = await counts()
  assert.equal(before.users, 7)
  assert.equal(before.invoices, 12)
  assert.equal(before.requests, 36)
  assert.ok(before.entries >= 540)
  await demoPool.query(
    "UPDATE service_requests.service_request SET title = 'Visitor edit' WHERE id = 'demo-garden-invoice-0-request-0'"
  )
  await resetDemoIfDue()
  assert.equal(
    (
      await demoPool.query(
        "SELECT title FROM service_requests.service_request WHERE id = 'demo-garden-invoice-0-request-0'"
      )
    ).rows[0].title,
    'Visitor edit'
  )
  await demoPool.query("UPDATE public.portal_demo_reset SET reset_day = '2000-01-01'")
  await Promise.all([resetDemoIfDue(), resetDemoIfDue()])
  assert.deepEqual(await counts(), before)
  assert.equal(
    (
      await demoPool.query(
        "SELECT title FROM service_requests.service_request WHERE id = 'demo-garden-invoice-0-request-0'"
      )
    ).rows[0].title,
    'Update the onboarding screens'
  )
  assert.equal((await demoPool.query('SELECT count(*)::int AS count FROM public.session')).rows[0].count, 0)
  console.log(
    'Database integration passed: full seed, same-day preservation, concurrent reset, visitor edits and sessions discarded'
  )
} finally {
  await demoPool.end()
}
