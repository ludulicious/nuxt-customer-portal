import assert from 'node:assert/strict'
import test from 'node:test'
import { readdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { registerHooks } from 'node:module'
import { Client } from 'pg'
import sharp from 'sharp'

test(
  'media migration, storage providers, atomic versions, access scopes, ordering and cleanup',
  { skip: !process.env.PRODUCTS_MEDIA_TEST_DATABASE_URL },
  async () => {
    const url = process.env.PRODUCTS_MEDIA_TEST_DATABASE_URL!
    assert.match(new URL(url).pathname, /^\/codex_products_test_/)
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_URL = 'http://localhost:3059'
    process.env.BETTER_AUTH_SECRET = 'media-test-secret-with-at-least-thirty-two-characters'
    const hook = registerHooks({
      resolve(specifier, context, nextResolve) {
        return nextResolve(
          specifier,
          specifier === 'h3'
            ? { ...context, parentURL: new URL('../../core/package.json', import.meta.url).href }
            : context
        )
      }
    })
    const h3 = await import('h3')
    Object.assign(globalThis, h3, {
      useRuntimeConfig: () => ({
        public: { clients: {} },
        portalAuth: { registrationMode: 'open' },
        portalDemo: { enabled: false },
        portalEmail: {}
      })
    })
    const db = new Client({ connectionString: url })
    await db.connect()
    const objects = new Map<string, Buffer>()
    let failPut = false,
      writes = 0
    const storageServer = createServer(async (request, response) => {
      const key = request.url!.split('?')[0]!
      if (request.method === 'PUT') {
        if (failPut) {
          response.writeHead(503)
          response.end()
          return
        }
        const chunks = []
        for await (const chunk of request) {
          chunks.push(Buffer.from(chunk))
        }
        objects.set(key, Buffer.concat(chunks))
        writes++
        response.writeHead(200, { ETag: '"test"' })
        response.end()
        return
      }
      if (request.method === 'DELETE') {
        objects.delete(key)
        response.writeHead(204)
        response.end()
        return
      }
      const body = objects.get(key)
      response.writeHead(body ? 200 : 404, { 'Content-Type': 'image/png', 'Content-Length': body?.length || 0 })
      response.end(body)
    })
    await new Promise<void>((resolve) => storageServer.listen(0, 'localhost', resolve))
    const storageOrigin = `http://localhost:${(storageServer.address() as { port: number }).port}`
    let server: ReturnType<typeof createServer> | undefined
    let pool: { end: () => Promise<void> } | undefined
    try {
      for (const name of ['core', 'products']) {
        const directory = new URL(`../../${name}/migrations/`, import.meta.url)
        for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
          await db.query(await readFile(new URL(file, directory), 'utf8'))
        }
      }
      await db.query(
        `INSERT INTO public.organization(id,name,slug,created_at,organization_type) VALUES('media-store','Store','media-store',now(),'PROVIDER'),('media-other','Other','media-other',now(),'CLIENT')`
      )
      await db.query(
        `INSERT INTO public."user"(id,name,email,email_verified,role) VALUES('media-owner','Owner','media-owner@example.test',true,'admin')`
      )
      await db.query(
        `INSERT INTO public.member(id,organization_id,user_id,role,created_at) VALUES('media-member','media-store','media-owner','owner',now())`
      )
      await db.query(`INSERT INTO products.store(organization_id,actor_id) VALUES('media-store','media-owner')`)
      const media = await import('../server/utils/media')
      const { validateMediaImage } = await import('../server/utils/media-storage')
      pool = (await import('@nuxt-customer-portal/core/server/utils/db')).pool
      const original = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#669933' } })
        .png()
        .toBuffer()
      const cropped = await sharp(original).extract({ left: 0, top: 0, width: 400, height: 400 }).png().toBuffer()
      const thumbnail = await sharp(original).resize(200, 150).png().toBuffer()
      const details = {
        title: 'Forest',
        alt: 'A green forest',
        categories: ['Nature'],
        credit: 'Photographer',
        visible: true
      }
      const transfer = async (storeId: string, body: Buffer, role: 'original' | 'image' | 'thumbnail' = 'original') => {
        const upload = await media.startMediaUpload(storeId, {
          files: [{ role, name: `${role}.png`, contentType: 'image/png', size: body.length }]
        })
        await media.putMediaUpload(storeId, upload.id, upload.files[0]!.id, body)
        return upload
      }
      const saved = []
      for (const provider of ['bunny', 's3']) {
        process.env.PRODUCTS_STORAGE_PROVIDER = provider
        process.env.PRODUCTS_BUNNY_STORAGE_ZONE = 'test'
        process.env.PRODUCTS_BUNNY_STORAGE_PASSWORD = 'test-password'
        process.env.PRODUCTS_BUNNY_STORAGE_ENDPOINT = storageOrigin
        process.env.PRODUCTS_S3_BUCKET = 'test'
        process.env.PRODUCTS_S3_ENDPOINT = storageOrigin
        process.env.PRODUCTS_S3_PATH_STYLE = 'true'
        process.env.AWS_ACCESS_KEY_ID = 'test'
        process.env.AWS_SECRET_ACCESS_KEY = 'test'
        const upload = await transfer('media-store', original)
        let image = await media.saveMedia('media-store', { ...details, uploadId: upload.id })
        assert.deepEqual(
          await media.mediaContent('media-store', image.id, true, 'original').then((result) => result.body),
          original
        )
        assert.equal(image.image.width, 800)
        assert.equal(
          (await media.saveMedia('media-store', { ...details, uploadId: upload.id })).id,
          image.id,
          'completion retry is idempotent'
        )
        const count = writes
        image = await media.saveMedia('media-store', {
          ...details,
          id: image.id,
          revision: image.revision,
          title: `${provider} forest`
        })
        assert.equal(writes, count, 'metadata saves do not upload bytes')
        await assert.rejects(
          media.saveMedia('media-store', { ...details, id: image.id, revision: image.revision - 1 }),
          { statusCode: 409 }
        )
        const edit = await media.startMediaUpload('media-store', {
          files: [
            { role: 'image', name: 'crop.png', contentType: 'image/png', size: cropped.length },
            { role: 'thumbnail', name: 'thumb.png', contentType: 'image/png', size: thumbnail.length }
          ]
        })
        await media.putMediaUpload('media-store', edit.id, edit.files[0]!.id, cropped)
        await assert.rejects(
          media.saveMedia('media-store', { ...details, id: image.id, revision: image.revision, uploadId: edit.id }),
          { statusCode: 409 }
        )
        assert.equal(
          (await media.getMedia('media-store', image.id, true)).image.width,
          800,
          'unfinished saves preserve committed image'
        )
        await media.putMediaUpload('media-store', edit.id, edit.files[1]!.id, thumbnail)
        image = await media.saveMedia('media-store', {
          ...details,
          id: image.id,
          revision: image.revision,
          uploadId: edit.id
        })
        assert.equal(image.image.width, 400)
        assert.equal(image.thumbnail?.width, 400)
        assert.equal(image.variants.thumbnail?.mode, 'custom')
        assert.equal(image.variants.thumbnail?.source?.width, 200)
        assert.deepEqual((await media.mediaContent('media-store', image.id, true, 'original')).body, original)
        const reset = await transfer('media-store', original, 'image')
        image = await media.saveMedia('media-store', {
          ...details,
          id: image.id,
          revision: image.revision,
          uploadId: reset.id
        })
        assert.equal(image.image.width, 800)
        assert.equal(image.thumbnail?.width, 400, 'reset leaves independent thumbnail intact')
        saved.push(image)
        const invalid = await media.startMediaUpload('media-store', {
          files: [{ role: 'original', name: 'bad.png', contentType: 'image/png', size: 8 }]
        })
        await assert.rejects(
          media.putMediaUpload('media-store', invalid.id, invalid.files[0]!.id, Buffer.from('notapng!')),
          { statusCode: 422 }
        )
        await assert.rejects(
          media.putMediaUpload('media-other', invalid.id, invalid.files[0]!.id, Buffer.from('notapng!')),
          { statusCode: 404 }
        )
      }
      await assert.rejects(validateMediaImage(original, 'image/jpeg'), { statusCode: 422 })
      await assert.rejects(validateMediaImage(Buffer.alloc(10 * 1024 * 1024 + 1), 'image/png'), { statusCode: 400 })
      const retry = await media.startMediaUpload('media-store', {
        files: [{ role: 'original', name: 'retry.png', contentType: 'image/png', size: original.length }]
      })
      // Bunny returns failure immediately; retry retains the same upload session.
      process.env.PRODUCTS_STORAGE_PROVIDER = 'bunny'
      failPut = true
      await assert.rejects(media.putMediaUpload('media-store', retry.id, retry.files[0]!.id, original), {
        statusCode: 502
      })
      failPut = false
      await media.putMediaUpload('media-store', retry.id, retry.files[0]!.id, original)
      let hidden = await media.saveMedia('media-store', { ...details, visible: false, uploadId: retry.id })
      assert.equal((await media.listMedia('media-store', false, {})).items.length, 2)
      assert.equal(
        (await media.listMedia('media-store', true, { search: 'forest', category: 'Nature' })).pagination.total,
        3
      )
      await assert.rejects(media.getMedia('media-store', hidden.id, false), { statusCode: 404 })
      await assert.rejects(media.getMedia('media-other', hidden.id, true), { statusCode: 404 })
      await assert.rejects(media.mediaContent('media-store', saved[0]!.id, false, 'original'), { statusCode: 404 })
      await media.reorderMedia('media-store', { id: hidden.id, beforeId: saved[0]!.id, revision: hidden.revision })
      assert.equal((await media.listMedia('media-store', true, {})).items[0]!.id, hidden.id)
      hidden = await media.getMedia('media-store', hidden.id, true)
      const { auth } = await import('@nuxt-customer-portal/core/server/utils/auth')
      const key = async (organizationId: string, permissions: Record<string, string[]>) => {
        const created = await auth.api.createApiKey({
          body: {
            name: 'Media test',
            organizationId: 'media-store',
            userId: 'media-owner',
            permissions,
            rateLimitEnabled: false
          }
        })
        if (organizationId !== 'media-store') {
          await db.query('UPDATE public.apikey SET reference_id=$2 WHERE id=$1', [created.id, organizationId])
        }
        return created.key
      }
      const readKey = await key('media-store', { 'products.media': ['read'] })
      const manageKey = await key('media-store', { 'products.media': ['manage'] })
      const noScopeKey = await key('media-store', { 'products.catalog': ['read'] })
      await db.query(
        `INSERT INTO public.member(id,organization_id,user_id,role,created_at) VALUES('media-other-member','media-other','media-owner','owner',now())`
      )
      const otherKey = await key('media-other', { 'products.media': ['manage'] })
      const app = h3.createApp(),
        router = h3.createRouter()
      app.use((await import('../../core/server/middleware/auth')).default)
      router.get('/api/products/media', (await import('../server/utils/media-handler')).default)
      router.put('/api/products/media', (await import('../server/utils/media-handler')).default)
      router.get('/api/products/media/:id', (await import('../server/utils/media-handler')).default)
      router.get('/api/products/media/:id/content', (await import('../server/utils/media-handler')).default)
      router.post('/api/products/media/uploads', (await import('../server/utils/media-handler')).default)
      router.put(
        '/api/products/media/uploads/:uploadId/:fileId',
        (await import('../server/utils/media-handler')).default
      )
      router.post(
        '/api/products/media/uploads/:uploadId/complete',
        (await import('../server/utils/media-handler')).default
      )
      router.delete('/api/products/media/:id', (await import('../server/utils/media-handler')).default)
      app.use(router)
      server = createServer(h3.toNodeListener(app))
      await new Promise<void>((resolve) => server!.listen(0, 'localhost', resolve))
      const origin = `http://localhost:${(server.address() as { port: number }).port}`
      const request = (path: string, token?: string, method = 'GET', body?: unknown) =>
        fetch(`${origin}/api/products/media${path}`, {
          method,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {})
          },
          body: body ? JSON.stringify(body) : undefined
        })
      assert.equal((await request('')).status, 401)
      assert.equal((await request('', 'bad-key')).status, 401)
      assert.equal((await request('', noScopeKey)).status, 403)
      assert.equal((await request('', otherKey)).status, 403)
      assert.equal((await request(`/${hidden.id}`, readKey)).status, 404)
      assert.equal((await request(`/${hidden.id}/content`, readKey)).status, 404)
      assert.equal((await request(`/${hidden.id}`, manageKey)).status, 200)
      const response = await request('', readKey)
      assert.equal(response.status, 200)
      const page = await response.json()
      assert.equal(page.items.length, 2)
      assert.equal('original' in page.items[0], false)
      assert.equal((await request('/uploads', readKey, 'POST', {})).status, 403)
      assert.equal((await request('', readKey, 'PUT', {})).status, 403)
      assert.equal((await request(`/${saved[0]!.id}/content?variant=original`, readKey)).status, 404)
      assert.equal((await request(`/${saved[0]!.id}/content`)).status, 401)
      const content = await request(`/${saved[0]!.id}/content`, readKey)
      assert.equal(content.status, 200)
      assert.equal(content.headers.get('cache-control'), 'private, no-store')
      assert.equal(content.headers.get('location'), null)
      assert.deepEqual(Buffer.from(await content.arrayBuffer()), original)
      assert.equal((await request(`/${hidden.id}`, readKey, 'DELETE', { revision: hidden.revision })).status, 403)
      const apiUploadResponse = await request('/uploads', manageKey, 'POST', {
        files: [{ role: 'original', name: 'api.png', contentType: 'image/png', size: original.length }]
      })
      assert.equal(apiUploadResponse.status, 200)
      const apiUpload = await apiUploadResponse.json()
      const rawUpload = await fetch(`${origin}${apiUpload.files[0].url}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${manageKey}`, 'Content-Type': 'image/png' },
        body: Uint8Array.from(original)
      })
      assert.equal(rawUpload.status, 200)
      assert.equal(
        (await request(`/uploads/${apiUpload.id}/complete`, manageKey, 'POST', { ...details, title: 'API upload' }))
          .status,
        200
      )
      const gif = Buffer.from(
        '47494638396101000100800000000000ffffff21ff0b4e45545343415045322e30030100000021f904000a0000002c000000000100010000020244010021f904000a0000002c00000000010001000002024c01003b',
        'hex'
      )
      assert.equal((await sharp(gif, { animated: true }).metadata()).pages, 2)
      const gifUpload = await media.startMediaUpload('media-store', {
        files: [{ role: 'original', name: 'animated.gif', contentType: 'image/gif', size: gif.length }]
      })
      await media.putMediaUpload('media-store', gifUpload.id, gifUpload.files[0]!.id, gif)
      const gifMedia = await media.saveMedia('media-store', { ...details, uploadId: gifUpload.id })
      assert.deepEqual(
        (await media.mediaContent('media-store', gifMedia.id, true, 'image')).body,
        gif,
        'GIF animation bytes are retained'
      )
      const gifEdit = await transfer('media-store', cropped, 'image')
      await assert.rejects(
        media.saveMedia('media-store', {
          ...details,
          id: gifMedia.id,
          revision: gifMedia.revision,
          uploadId: gifEdit.id
        }),
        { statusCode: 400 }
      )
      const { mediaVariantConfiguration, saveMediaVariantConfiguration } =
        await import('../server/utils/media-variants')
      const beforePolicy = (await db.query('SELECT image_policy FROM products.store')).rows[0].image_policy
      const config = await mediaVariantConfiguration('media-store')
      const beforeSettings = await media.getMedia('media-store', saved[1]!.id, true)
      const beforeFiles = (
        await db.query('SELECT key,file_id FROM products.media_variant WHERE media_id=$1 ORDER BY key', [
          beforeSettings.id
        ])
      ).rows
      const oldThumbnail = (await media.mediaContent('media-store', beforeSettings.id, true, 'thumbnail')).body
      const beforeConfigWrites = writes
      const changed = await saveMediaVariantConfiguration('media-store', {
        revision: config.revision,
        presets: [
          ...config.presets.map((preset) =>
            preset.key === 'thumbnail' ? { ...preset, width: 320, height: 240 } : preset
          ),
          { key: 'hero', label: 'Hero', width: 1000, height: 640 }
        ]
      })
      assert.equal(writes, beforeConfigWrites, 'preset changes do not generate files')
      assert.deepEqual(
        (
          await db.query('SELECT key,file_id FROM products.media_variant WHERE media_id=$1 ORDER BY key', [
            beforeSettings.id
          ])
        ).rows,
        beforeFiles
      )
      assert.equal((await media.getMedia('media-store', beforeSettings.id, true)).variantsOutdated, true)
      assert.deepEqual(
        (await db.query('SELECT image_policy FROM products.store')).rows[0].image_policy,
        beforePolicy,
        'product dimensions are unchanged'
      )
      await assert.rejects(
        media.saveMedia('media-store', {
          ...details,
          id: beforeSettings.id,
          revision: beforeSettings.revision,
          presetRevision: config.revision
        }),
        { statusCode: 409 }
      )
      let refreshed = await media.saveMedia('media-store', {
        ...details,
        id: beforeSettings.id,
        revision: beforeSettings.revision,
        presetRevision: changed.revision
      })
      assert.equal(refreshed.variantsOutdated, false)
      assert.equal(refreshed.variants.hero?.width, 1000)
      assert.equal(refreshed.variants.hero?.height, 640)
      assert.equal(refreshed.variants.thumbnail?.mode, 'custom')
      assert.equal(refreshed.thumbnail?.width, 320)
      assert.equal(refreshed.thumbnail?.height, 240)
      assert.equal(refreshed.variants.thumbnail?.source?.width, 200)
      const customThumbnail = (await media.mediaContent('media-store', refreshed.id, true, 'thumbnail')).body
      assert.notDeepEqual(customThumbnail, oldThumbnail, 'custom sources are resized to new dimensions on save')
      const heroBefore = (await media.mediaContent('media-store', refreshed.id, true, 'hero')).body
      const newFullSource = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#cc3322' } })
        .png()
        .toBuffer()
      const newFull = await transfer('media-store', newFullSource, 'image')
      refreshed = await media.saveMedia('media-store', {
        ...details,
        id: refreshed.id,
        revision: refreshed.revision,
        uploadId: newFull.id,
        presetRevision: changed.revision
      })
      assert.deepEqual(
        (await media.mediaContent('media-store', refreshed.id, true, 'thumbnail')).body,
        customThumbnail,
        'custom crops survive full-image edits'
      )
      assert.notDeepEqual(
        (await media.mediaContent('media-store', refreshed.id, true, 'hero')).body,
        heroBefore,
        'automatic variants follow the new full image'
      )
      await assert.rejects(media.mediaContent('media-store', refreshed.id, false, 'hero', true), { statusCode: 404 })
      assert.equal('source' in (await media.getMedia('media-store', refreshed.id, false)).variants.hero!, false)
      refreshed = await media.saveMedia('media-store', {
        ...details,
        id: refreshed.id,
        revision: refreshed.revision,
        resetVariants: ['thumbnail'],
        presetRevision: changed.revision
      })
      assert.equal(refreshed.variants.thumbnail?.mode, 'automatic')
      assert.equal(refreshed.variants.thumbnail?.source?.width, 400)
      const removed = await saveMediaVariantConfiguration('media-store', {
        revision: changed.revision,
        presets: changed.presets.filter((preset) => preset.key !== 'hero')
      })
      assert.ok(
        (await media.getMedia('media-store', refreshed.id, true)).variants.hero,
        'removed presets remain until that image is saved'
      )
      refreshed = await media.saveMedia('media-store', {
        ...details,
        id: refreshed.id,
        revision: refreshed.revision,
        presetRevision: removed.revision
      })
      assert.equal(refreshed.variants.hero, undefined)
      await assert.rejects(media.mediaContent('media-store', refreshed.id, true, 'hero'), { statusCode: 404 })
      await assert.rejects(
        saveMediaVariantConfiguration('media-store', {
          revision: removed.revision,
          presets: removed.presets.filter((preset) => preset.key !== 'thumbnail')
        }),
        { statusCode: 400 }
      )
      const { linkProductMedia, productMediaContent, productAssets } = await import('../server/utils/product-media')
      await db.query(
        `INSERT INTO products.product(id,store_id,slug,data) VALUES('linked-product','media-store','linked-product','{"imageIds":[]}'),('foreign-product','media-other','foreign-product','{"imageIds":[]}')`
      )
      const beforeLinkWrites = writes
      const selection = { mediaId: refreshed.id, purpose: 'gallery', variant: 'gallery' }
      const linked = await linkProductMedia('media-store', 'linked-product', selection)
      assert.equal(writes, beforeLinkWrites, 'linking never copies or rewrites image files')
      assert.equal(
        (await linkProductMedia('media-store', 'linked-product', selection)).id,
        linked.id,
        'attachment retries are idempotent'
      )
      await assert.rejects(linkProductMedia('media-store', 'foreign-product', selection), { statusCode: 404 })
      await assert.rejects(linkProductMedia('media-other', 'foreign-product', selection), { statusCode: 400 })
      await assert.rejects(linkProductMedia('media-store', 'linked-product', { ...selection, variant: 'original' }), {
        statusCode: 400
      })
      await assert.rejects(linkProductMedia('media-store', 'linked-product', { ...selection, variant: 'missing' }), {
        statusCode: 400
      })
      await db.query(
        `UPDATE products.product SET data=jsonb_build_object('imageIds',jsonb_build_array($1::text)) WHERE id='linked-product'`,
        [linked.id]
      )
      await assert.rejects(media.deleteMedia('media-store', refreshed.id, refreshed.revision), {
        statusCode: 409,
        data: { code: 'media_in_use' }
      })
      await assert.rejects(
        saveMediaVariantConfiguration('media-store', {
          revision: removed.revision,
          presets: removed.presets.filter((p) => p.key !== 'gallery')
        }),
        { statusCode: 409, data: { code: 'variant_in_use' } }
      )
      const linkedBody = (await productMediaContent(linked.id)).body
      for (const provider of ['s3', 'bunny']) {
        process.env.PRODUCTS_STORAGE_PROVIDER = provider
        assert.deepEqual(
          (await productMediaContent(linked.id)).body,
          linkedBody,
          `${provider} resolves linked media content`
        )
      }
      const replacement = await transfer('media-store', original, 'image')
      refreshed = await media.saveMedia('media-store', {
        ...details,
        id: refreshed.id,
        revision: refreshed.revision,
        uploadId: replacement.id
      })
      assert.notDeepEqual(
        (await productMediaContent(linked.id)).body,
        linkedBody,
        'library edits flow through without replacing product references'
      )
      const currentAssets = await productAssets('linked-product')
      assert.equal(currentAssets[0]?.media_id, refreshed.id)
      assert.equal(currentAssets[0]?.width, refreshed.variants.gallery?.file.width)
      assert.equal(currentAssets[0]?.alternative_text, refreshed.alt)
      refreshed = await media.saveMedia('media-store', {
        ...details,
        visible: false,
        id: refreshed.id,
        revision: refreshed.revision
      })
      await assert.rejects(productMediaContent(linked.id), { statusCode: 404 })
      assert.ok(
        (await productMediaContent(linked.id, true)).body.length,
        'administrators can preview hidden linked media'
      )
      await assert.rejects(linkProductMedia('media-store', 'linked-product', { ...selection, purpose: 'detail' }), {
        statusCode: 400
      })
      refreshed = await media.saveMedia('media-store', { ...details, id: refreshed.id, revision: refreshed.revision })
      await db.query(`DELETE FROM products.product WHERE id IN ('linked-product','foreign-product')`)
      const gifVariant = await media.mediaContent('media-store', gifMedia.id, true, 'thumbnail')
      const gifMetadata = await sharp(gifVariant.body, { animated: true }).metadata()
      assert.equal(gifMetadata.pages, 2, 'automatic GIF variants preserve animation')
      assert.equal(gifMetadata.width, 400)
      assert.equal(gifMetadata.pageHeight, 400)
      const oversizedPixels = await sharp({ create: { width: 8000, height: 5001, channels: 3, background: '#000000' } })
        .png()
        .toBuffer()
      await assert.rejects(validateMediaImage(oversizedPixels, 'image/png'), { statusCode: 422 })
      const sourceRow = (await db.query('SELECT * FROM products.media WHERE id=$1', [saved[1]!.id])).rows[0]
      for (let index = 0; index < 25; index++) {
        await db.query(
          'INSERT INTO products.media(id,store_id,title,alt,categories,original_file_id,image_file_id,position) VALUES($1,$2,$3,$4,$5,$6,$6,$7)',
          [
            `pagination-${index}`,
            'media-store',
            `Pagination ${index}`,
            'Page fixture',
            ['Pages'],
            sourceRow.original_file_id,
            100 + index
          ]
        )
      }
      const firstPage = await media.listMedia('media-store', false, { category: 'Pages' })
      const secondPage = await media.listMedia('media-store', false, { category: 'Pages', page: 2 })
      assert.equal(firstPage.items.length, 20)
      assert.equal(secondPage.items.length, 5)
      assert.equal(firstPage.pagination.total, 25)
      assert.equal(new Set([...firstPage.items, ...secondPage.items].map((item) => item.id)).size, 25)
      assert.equal((await media.listMedia('media-store', false, { category: 'Pages', page: 999 })).pagination.page, 2)
      const current = await media.getMedia('media-store', saved[0]!.id, true)
      await assert.rejects(media.deleteMedia('media-store', current.id, current.revision - 1), { statusCode: 409 })
      await media.deleteMedia('media-store', current.id, current.revision)
      await db.query("UPDATE products.media_upload SET created_at=now()-interval '2 days'")
      const remainingOriginal = (await media.mediaContent('media-store', saved[1]!.id, true, 'original')).body
      assert.ok((await media.cleanupMedia()) > 0)
      assert.deepEqual(
        (await media.mediaContent('media-store', saved[1]!.id, true, 'original')).body,
        remainingOriginal,
        'cleanup preserves committed originals'
      )
      assert.equal(
        Number((await db.query('SELECT count(*) FROM products.asset')).rows[0].count),
        0,
        'product images are untouched'
      )
    } finally {
      await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
      await new Promise<void>((resolve) => storageServer.close(() => resolve()))
      await db.end()
      await pool?.end()
      hook.deregister()
    }
  }
)
