import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { Client } from 'pg'
// Run only against an explicitly supplied empty, disposable database.
test(
  'migrations preserve defaults and enforce personal membership under concurrent writes',
  { skip: !process.env.PORTAL_TEST_DATABASE_URL },
  async () => {
    const connectionString = process.env.PORTAL_TEST_DATABASE_URL!
    assert.match(new URL(connectionString).pathname, /codex_clients_test_/)
    const db = new Client({ connectionString })
    await db.connect()
    try {
      for (const file of (await readdir(new URL('../../core/migrations/', import.meta.url)))
        .filter((file) => file.endsWith('.sql') && file < '0006')
        .sort()) {
        await db.query(await readFile(new URL(`../../core/migrations/${file}`, import.meta.url), 'utf8'))
      }
      await db.query(
        `INSERT INTO organization (id,name,slug,created_at,organization_type) VALUES ('provider','Coach','coach',now(),'PROVIDER'), ('company','Company','company',now(),'CLIENT')`
      )
      await db.query(
        `CREATE SCHEMA timesheets; CREATE TABLE timesheets.workspace_settings (organization_id text PRIMARY KEY, timezone text); INSERT INTO timesheets.workspace_settings VALUES ('provider','America/New_York')`
      )
      await db.query(
        await readFile(new URL('../../core/migrations/0006_timezone_preferences.sql', import.meta.url), 'utf8')
      )
      await db.query(await readFile(new URL('../migrations/0000_baseline.sql', import.meta.url), 'utf8'))
      await db.query(`INSERT INTO clients.client_profile (organization_id,official_name) VALUES ('company','Company')`)
      await db.query(await readFile(new URL('../migrations/0001_person_clients.sql', import.meta.url), 'utf8'))
      assert.equal((await db.query('SELECT timezone FROM organization_settings')).rows[0].timezone, 'America/New_York')
      assert.equal(
        (await db.query('SELECT timezone FROM timesheets.workspace_settings')).rows[0].timezone,
        'America/New_York'
      )
      assert.equal(
        (await db.query('SELECT client_type FROM clients.client_profile')).rows[0].client_type,
        'organization'
      )
      await db.query(
        `INSERT INTO "user" (id,name,email,email_verified,created_at,updated_at) VALUES ('a','A','a@example.test',true,now(),now()),('b','B','b@example.test',true,now(),now()),('c','C','c@example.test',true,now(),now())`
      )
      for (const id of ['p1', 'p2', 'p3']) {
        await db.query(
          `INSERT INTO organization (id,name,slug,created_at,organization_type) VALUES ($1,$1,$1,now(),'CLIENT')`,
          [id]
        )
        await db.query(
          `INSERT INTO clients.client_profile (organization_id,official_name,client_type) VALUES ($1,$1,'person')`,
          [id]
        )
      }
      const second = new Client({ connectionString })
      await second.connect()
      const insert = (client: Client, id: string, org: string, user: string) =>
        client.query(
          `INSERT INTO member (id,organization_id,user_id,role,created_at) VALUES ($1,$2,$3,'owner',now())`,
          [id, org, user]
        )
      try {
        const samePerson = await Promise.allSettled([insert(db, 'm1', 'p1', 'a'), insert(second, 'm2', 'p2', 'a')])
        assert.equal(samePerson.filter((r) => r.status === 'fulfilled').length, 1)
        const sameAccount = await Promise.allSettled([insert(db, 'm3', 'p3', 'b'), insert(second, 'm4', 'p3', 'c')])
        assert.equal(sameAccount.filter((r) => r.status === 'fulfilled').length, 1)
        await assert.rejects(db.query(`UPDATE member SET role='admin' WHERE organization_id='p3'`))
        await assert.rejects(
          db.query(`UPDATE clients.client_profile SET client_type='person' WHERE organization_id='company'`)
        )
        await assert.rejects(db.query(`UPDATE clients.client_profile SET vat_number='123' WHERE organization_id='p3'`))
        await insert(db, 'company-member', 'company', 'a')
        assert.equal((await db.query(`SELECT count(*) FROM member WHERE user_id='a'`)).rows[0].count, '2')
      } finally {
        await second.end()
      }
    } finally {
      await db.end()
    }
  }
)
