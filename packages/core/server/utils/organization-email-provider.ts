import { Resend } from 'resend'
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from './db'
import { organizationEmailCredential } from '@nuxt-customer-portal/core/server/db/schema/auth-schema'

type DomainCache = { fingerprint: string; expiresAt: number; domains: Set<string> }
const domainCache = new Map<string, DomainCache>()

export class EmailProviderRejectedError extends Error {
  constructor(
    message: string,
    readonly reason:
      'DOMAIN_PERMISSION_REQUIRED' | 'PROVIDER_NOT_CONFIGURED' | 'PROVIDER_REJECTED' = 'PROVIDER_REJECTED'
  ) {
    super(message)
    this.name = 'EmailProviderRejectedError'
  }
}

const listDomains = async (apiKey: string) => {
  const { data, error } = await new Resend(apiKey).domains.list({ limit: 100 })
  if (error) {
    const reason = /restricted to only send emails/i.test(error.message)
      ? 'DOMAIN_PERMISSION_REQUIRED'
      : 'PROVIDER_REJECTED'
    throw new EmailProviderRejectedError(error.message, reason)
  }
  return new Set(
    data.data
      .filter((item) => item.status === 'verified' && item.capabilities.sending === 'enabled')
      .map((item) => item.name.toLowerCase())
  )
}

export const getOrganizationEmailCredentialStatus = async (organizationId: string, forceRefresh = false) => {
  const [credential] = await db
    .select()
    .from(organizationEmailCredential)
    .where(eq(organizationEmailCredential.organizationId, organizationId))
    .limit(1)
  if (!credential?.apiKey) {
    return {
      configured: false,
      keyLastFour: null,
      updatedAt: credential?.updatedAt.toISOString() ?? null,
      verifiedDomains: [] as string[]
    }
  }
  const fingerprint = credential.keyFingerprint ?? ''
  const cached = domainCache.get(organizationId)
  let domains: Set<string>
  if (!forceRefresh && cached?.fingerprint === fingerprint && cached.expiresAt > Date.now()) {
    domains = cached.domains
  } else {
    domains = await listDomains(credential.apiKey)
    domainCache.set(organizationId, { fingerprint, domains, expiresAt: Date.now() + 5 * 60_000 })
  }
  return {
    configured: true,
    keyLastFour: credential.keyLastFour,
    updatedAt: credential.updatedAt.toISOString(),
    verifiedDomains: [...domains]
  }
}

export const configureOrganizationEmailCredential = async (organizationId: string, userId: string, apiKey: string) => {
  await listDomains(apiKey)
  const keyFingerprint = createHash('sha256').update(apiKey).digest('hex')
  const keyLastFour = apiKey.slice(-4)
  await db
    .insert(organizationEmailCredential)
    .values({ organizationId, apiKey, keyFingerprint, keyLastFour, configuredById: userId })
    .onConflictDoUpdate({
      target: organizationEmailCredential.organizationId,
      set: {
        apiKey,
        keyFingerprint,
        keyLastFour,
        configuredById: userId,
        removedById: null,
        removedAt: null,
        updatedAt: new Date()
      }
    })
  domainCache.delete(organizationId)
  return getOrganizationEmailCredentialStatus(organizationId, true)
}

export const removeOrganizationEmailCredential = async (organizationId: string, userId: string) => {
  await db
    .insert(organizationEmailCredential)
    .values({
      organizationId,
      apiKey: null,
      keyFingerprint: null,
      keyLastFour: null,
      removedById: userId,
      removedAt: new Date()
    })
    .onConflictDoUpdate({
      target: organizationEmailCredential.organizationId,
      set: {
        apiKey: null,
        keyFingerprint: null,
        keyLastFour: null,
        removedById: userId,
        removedAt: new Date(),
        updatedAt: new Date()
      }
    })
  domainCache.delete(organizationId)
}

export const getOrganizationVerifiedEmailDomains = async (organizationId: string, forceRefresh = false) => {
  const status = await getOrganizationEmailCredentialStatus(organizationId, forceRefresh)
  return new Set(status.verifiedDomains)
}

export const sendOrganizationEmail = async (
  organizationId: string,
  input: {
    from: string
    to: string
    cc: string[]
    subject: string
    html: string
    text: string
    attachments: Array<{ filename: string; content: Buffer; contentType?: string }>
    idempotencyKey: string
  }
) => {
  const [credential] = await db
    .select()
    .from(organizationEmailCredential)
    .where(eq(organizationEmailCredential.organizationId, organizationId))
    .limit(1)
  if (!credential?.apiKey) {
    throw new Error('Organization email provider is not configured')
  }
  const { data, error } = await new Resend(credential.apiKey).emails.send(
    { ...input, cc: input.cc.length ? input.cc : undefined },
    { idempotencyKey: input.idempotencyKey }
  )
  if (error) {
    throw new EmailProviderRejectedError(error.message)
  }
  return data
}

export const retrieveOrganizationEmail = async (organizationId: string, providerMessageId: string) => {
  const [credential] = await db
    .select()
    .from(organizationEmailCredential)
    .where(eq(organizationEmailCredential.organizationId, organizationId))
    .limit(1)
  if (!credential?.apiKey) {
    throw new EmailProviderRejectedError('Organization email provider is not configured', 'PROVIDER_NOT_CONFIGURED')
  }
  const { data, error } = await new Resend(credential.apiKey).emails.get(providerMessageId)
  if (error) {
    throw new EmailProviderRejectedError(error.message)
  }
  return data
}
