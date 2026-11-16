import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'

const databaseUrl = process.env.PORTAL_IMAGE_TEST_DATABASE_URL
test(
  'image access requires ownership, shared membership or active provider administration',
  { skip: !databaseUrl },
  async () => {
    assert.match(new URL(databaseUrl!).pathname, /^\/portal_[a-z0-9_]+_test$/)
    const client = new Client({ connectionString: databaseUrl })
    await client.connect()
    let pool: { end(): Promise<void> } | undefined
    try {
      await client.query('begin')
      await client.query(`create table public.organization (id text, name text, slug text, logo text, metadata text,
      organization_type text, created_at timestamp);
      create table public.member (id text, user_id text, organization_id text, role text);
      create table public."user" (id text, image text);
      insert into public.organization values ('provider','Provider','provider','provider-logo',null,'PROVIDER',now()),
        ('a','Client A','a','client-a-logo','{"avatarLogo":"client-a-avatar"}','CLIENT',now()),
        ('b','Client B','b','client-b-logo',null,'CLIENT',now());
      insert into public.member values ('1','owner','provider','owner'),('2','provider-member','provider','member'),
        ('3','alice','a','owner'),('4','teammate','a','member'),('5','bob','b','owner');
      insert into public."user" values ('owner','owner-image'),('provider-member','member-image'),('alice','alice-image'),
        ('teammate','teammate-image'),('bob','bob-image'),('outsider','outsider-image');`)
      process.env.DATABASE_URL = databaseUrl
      globalThis.portalDatabase = drizzle(client)
      const database = await import('../server/utils/db')
      pool = database.pool
      const { readPortalImage } = await import('../server/utils/portal-image-access')
      const session = (id: string, activeOrganizationId: string | null, role = 'user') => ({
        user: { id, role },
        activeOrganizationId
      })
      const alice = session('alice', 'a')
      assert.equal(await readPortalImage(alice, 'user', 'alice', 'avatar'), 'alice-image')
      assert.equal(await readPortalImage(alice, 'user', 'teammate', 'avatar'), 'teammate-image')
      assert.equal(await readPortalImage(alice, 'user', 'bob', 'avatar'), null)
      assert.equal(await readPortalImage(alice, 'organization', 'a', 'logo'), 'client-a-logo')
      assert.equal(await readPortalImage(alice, 'organization', 'a', 'avatar'), 'client-a-avatar')
      assert.equal(await readPortalImage(alice, 'organization', 'b', 'logo'), null)
      assert.equal(await readPortalImage(session('owner', 'provider'), 'organization', 'b', 'logo'), 'client-b-logo')
      assert.equal(await readPortalImage(session('owner', 'provider'), 'user', 'bob', 'avatar'), 'bob-image')
      assert.equal(await readPortalImage(session('owner', 'provider'), 'user', 'outsider', 'avatar'), null)
      assert.equal(await readPortalImage(session('owner', null), 'user', 'bob', 'avatar'), null)
      assert.equal(await readPortalImage(session('provider-member', 'provider'), 'user', 'bob', 'avatar'), null)
      assert.equal(await readPortalImage(session('owner', 'provider'), 'user', 'bob', 'logo'), null)
      assert.equal(await readPortalImage(session('owner', 'provider'), 'user', 'missing', 'avatar'), null)
      assert.equal(await readPortalImage(session('admin', null, 'admin'), 'organization', 'b', 'logo'), 'client-b-logo')
      await client.query(`delete from public.member where user_id='teammate'`)
      assert.equal(await readPortalImage(alice, 'user', 'teammate', 'avatar'), null)
    } finally {
      delete globalThis.portalDatabase
      await client.query('rollback')
      await client.end()
      await pool?.end()
    }
  }
)
