import {
  foreignKey,
  pgSchema,
  text,
  boolean,
  integer,
  bigint,
  jsonb,
  timestamp,
  uniqueIndex,
  index
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { organization, user } from '@nuxt-customer-portal/core/schema'
import type { ProductData, OrderSnapshot } from '../../../shared/types'

const schema = pgSchema('products')
const stamp = (name: string) => timestamp(name, { withTimezone: true }).defaultNow().notNull()
export const store = schema.table('store', {
  id: boolean('id').primaryKey().default(true),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id),
  actorId: text('actor_id')
    .notNull()
    .references(() => user.id),
  enabled: boolean('enabled').default(false).notNull(),
  defaultLocale: text('default_locale').default('en').notNull(),
  languages: text('languages')
    .array()
    .notNull()
    .default(sql`ARRAY['en','nl']::text[]`),
  markdownStyle: jsonb('markdown_style').notNull().default({}),
  currencyTaxBehavior: jsonb('currency_tax_behavior')
    .$type<Record<string, 'inclusive' | 'exclusive'>>()
    .notNull()
    .default({}),
  currencies: text('currencies')
    .array()
    .notNull()
    .default(sql`ARRAY['EUR']::text[]`),
  storageProvider: text('storage_provider').default('s3').notNull(),
  storageEndpoint: text('storage_endpoint'),
  storageRegion: text('storage_region'),
  storageBucket: text('storage_bucket'),
  storageAccessKeyId: text('storage_access_key_id'),
  storageSecretAccessKey: text('storage_secret_access_key'),
  storagePathStyle: boolean('storage_path_style').default(false).notNull(),
  storageTestedAt: timestamp('storage_tested_at', { withTimezone: true }),
  imagePolicy: jsonb('image_policy')
    .$type<{
      thumbnail: { width: number; height: number }
      gallery: { width: number; height: number }
      detail: { width: number; height: number }
    }>()
    .notNull()
    .default({
      thumbnail: { width: 400, height: 400 },
      gallery: { width: 800, height: 1000 },
      detail: { width: 1200, height: 900 }
    })
})
export const product = schema.table(
  'product',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => organization.id),
    categoryId: text('category_id'),
    slug: text('slug').notNull(),
    data: jsonb('data').$type<ProductData>().notNull(),
    createdAt: stamp('created_at'),
    updatedAt: stamp('updated_at')
  },
  (t) => [
    uniqueIndex('product_store_slug').on(t.storeId, t.slug),
    index('product_category_id').on(t.categoryId),
    foreignKey({
      name: 'product_category_fk',
      columns: [t.storeId, t.categoryId],
      foreignColumns: [category.storeId, category.id]
    }).onDelete('restrict')
  ]
)
export const price = schema.table(
  'price',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => product.id),
    currency: text('currency').notNull(),
    amount: integer('amount').notNull(),
    taxBehavior: text('tax_behavior').notNull(),
    active: boolean('active').default(true).notNull()
  },
  (t) => [
    uniqueIndex('price_active_currency')
      .on(t.productId, t.currency)
      .where(sql`${t.active}`)
  ]
)
export const asset = schema.table('asset', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => product.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  contentType: text('content_type').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  visibility: text('visibility').notNull(),
  objectKey: text('object_key').notNull().unique(),
  ready: boolean('ready').default(false).notNull(),
  status: text('status').default('uploading').notNull(),
  width: integer('width'),
  height: integer('height'),
  failureReason: text('failure_reason'),
  imagePurpose: text('image_purpose').$type<'thumbnail' | 'gallery' | 'detail'>(),
  sourceObjectKey: text('source_object_key'),
  createdAt: stamp('created_at')
})
export const apiKey = schema.table('api_key', {
  id: text('id').primaryKey(),
  storeId: text('store_id')
    .notNull()
    .references(() => organization.id),
  name: text('name').notNull(),
  hash: text('hash').notNull().unique(),
  prefix: text('prefix').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: stamp('created_at')
})
export const purchase = schema.table(
  'purchase',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => organization.id),
    productId: text('product_id')
      .notNull()
      .references(() => product.id),
    priceId: text('price_id')
      .notNull()
      .references(() => price.id),
    requestId: text('request_id').notNull().unique(),
    requestHash: text('request_hash').notNull(),
    buyerId: text('buyer_id').references(() => user.id),
    clientId: text('client_id').references(() => organization.id),
    email: text('email').notNull(),
    snapshot: jsonb('snapshot').$type<OrderSnapshot>().notNull(),
    status: text('status').notNull().default('pending'),
    checkoutId: text('checkout_id').unique(),
    paymentId: text('payment_id').unique(),
    total: integer('total'),
    net: integer('net'),
    tax: integer('tax'),
    taxDetails: jsonb('tax_details'),
    refunded: integer('refunded').default(0).notNull(),
    disputed: boolean('disputed').default(false).notNull(),
    fulfilled: boolean('fulfilled').default(false).notNull(),
    invoiceId: text('invoice_id'),
    invitationId: text('invitation_id'),
    notified: boolean('notified').default(false).notNull(),
    processing: text('processing').default('pending').notNull(),
    error: text('error'),
    createdAt: stamp('created_at'),
    updatedAt: stamp('updated_at')
  },
  (t) => [
    index('purchase_buyer').on(t.buyerId),
    index('purchase_email').on(t.email),
    index('purchase_store').on(t.storeId, t.createdAt)
  ]
)
export const webhook = schema.table('webhook', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  purchaseId: text('purchase_id'),
  createdAt: stamp('created_at'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  error: text('error')
})
export const rateLimit = schema.table('rate_limit', {
  id: text('id').primaryKey(),
  window: bigint('bucket_minute', { mode: 'number' }).notNull(),
  count: integer('count').notNull()
})

export const category = schema.table(
  'category',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => organization.id),
    name: text('name').notNull(),
    code: text('code').notNull(),
    content: jsonb('content').notNull()
  },
  (t) => [
    uniqueIndex('category_store_code').on(t.storeId, sql`lower(${t.code})`),
    uniqueIndex('category_store_id').on(t.storeId, t.id)
  ]
)
