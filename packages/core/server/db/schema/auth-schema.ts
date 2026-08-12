// Core authentication and organization schema owned by portal core.
/* eslint-disable @stylistic/semi */
/* eslint-disable semi */
/* eslint-disable @stylistic/quotes */
import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, check, index, uniqueIndex } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: text("role").default("user").notNull(),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
}, (table) => [
  index("user_name_idx").on(table.name),
  uniqueIndex("user_email_idx").on(table.email)
]);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
  impersonatedBy: text("impersonated_by"),
}, (table) => [
  index("session_user_id_idx").on(table.userId),
  index("session_active_organization_id_idx").on(table.activeOrganizationId)
]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
}, (table) => [
  index("account_user_id_idx").on(table.userId),
  index("account_account_id_idx").on(table.accountId),
  index("account_provider_id_idx").on(table.providerId)
]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
}, (table) => [
  index("verification_identifier_idx").on(table.identifier),
  index("verification_value_idx").on(table.value)
]);

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").notNull(),
  metadata: text("metadata"),
  organizationType: text("organization_type").notNull(),
}, (table) => [
  index("organization_slug_idx").on(table.slug),
  check("organization_type_check", sql`${table.organizationType} IN ('OWNER', 'CLIENT')`),
  uniqueIndex("organization_single_owner_uidx").on(table.organizationType).where(sql`${table.organizationType} = 'OWNER'`)
]);

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").default("member").notNull(),
  phone: text("phone"),
  jobTitle: text("job_title"),
  createdAt: timestamp("created_at").notNull(),
}, (table) => [
  index("member_organization_id_idx").on(table.organizationId),
  index("member_user_id_idx").on(table.userId)
]);

export const organizationEmailCredential = pgTable("organization_email_credential", {
  organizationId: text("organization_id").primaryKey().references(() => organization.id, { onDelete: "cascade" }),
  provider: text("provider").default("RESEND").notNull(),
  apiKey: text("api_key"),
  keyFingerprint: text("key_fingerprint"),
  keyLastFour: text("key_last_four"),
  configuredById: text("configured_by_id").references(() => user.id, { onDelete: "set null" }),
  removedById: text("removed_by_id").references(() => user.id, { onDelete: "set null" }),
  removedAt: timestamp("removed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()).notNull(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("invitation_organization_id_idx").on(table.organizationId),
  index("invitation_inviter_id_idx").on(table.inviterId),
  index("invitation_email_idx").on(table.email)
]);
