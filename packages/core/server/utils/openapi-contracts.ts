import { z } from 'zod'
import type { OpenApiDocument } from './openapi-order'

type JsonSchema = Record<string, unknown>
type OpenApiOperation = Record<string, unknown>

export interface PortalOpenApiContracts {
  owner: string
  query?: Record<string, z.ZodType>
  body?: Record<string, z.ZodType>
  requestBody?: Record<string, Record<string, unknown>>
}

const contractRegistryKey = Symbol.for('nuxt-customer-portal.openapi-contracts')
const contractRegistry = globalThis as typeof globalThis & {
  [contractRegistryKey]?: PortalOpenApiContracts[]
}

export const registerPortalOpenApiContracts = (contracts: PortalOpenApiContracts): void => {
  const registry = (contractRegistry[contractRegistryKey] ??= [])
  const index = registry.findIndex((item) => item.owner === contracts.owner)
  if (index === -1) {
    registry.push(contracts)
  } else {
    registry[index] = contracts
  }
}

const id = z.string().min(1).max(128)
const userQuerySchema = z.object({ search: z.string().trim().max(200).optional() })
const genericUserQuerySchema = z.object({
  take: z.coerce.number().int().min(1).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  sortField: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  filters: z.string().describe('JSON-encoded array of field, operator, and value filter objects.').optional()
})

const querySchemas: Record<string, z.ZodType> = {
  generalAdminUsersGet: userQuerySchema,
  generalAdminUsersQueryGet: genericUserQuerySchema,
  generalOrganizationsGetInvitationGet: z.object({ id })
}

const bodySchemas: Record<string, z.ZodType> = {
  generalAdminOrganizationsPost: z.object({
    name: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  }),
  generalAdminOrganizationsByIdPatch: z.object({
    name: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    officialCompanyName: z.string().min(1).max(200),
    logo: z.string().max(2_800_000)
  }),
  generalAdminOrganizationsByIdInvitationsPost: z.object({
    email: z.string().email(),
    role: z.enum(['member', 'admin', 'owner'])
  }),
  generalAdminUsersByIdRolePatch: z.object({ role: z.enum(['user', 'admin']) }),
  generalOrganizationsAcceptInvitationPost: z.object({ invitationId: id }),
  generalProfilePatch: z.object({
    name: z.string().min(1).max(255).optional(),
    image: z.string().url().nullable().optional()
  })
}

const parameterDescriptions: Record<string, string> = {
  search: 'Free-text search term.',
  page: 'One-based page number.',
  pageSize: 'Number of records per page.',
  sortBy: 'Field used to sort the results.',
  sortDir: 'Sort direction.',
  refresh: 'Set to 1 to refresh external provider status.',
  locale: 'Locale used to render localized invoice content.',
  week: 'Any date in the requested ISO week (YYYY-MM-DD).',
  section: 'Administration section whose supporting data should be loaded.',
  id: 'Invitation identifier.'
}

const jsonSchema = (schema: z.ZodType): JsonSchema => {
  const result = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema
  delete result.$schema
  return result
}

const queryParameters = (schema: z.ZodType): Array<Record<string, unknown>> => {
  const converted = jsonSchema(schema)
  const properties = (converted.properties ?? {}) as Record<string, JsonSchema>
  const required = new Set((converted.required ?? []) as string[])
  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: 'query',
    required: required.has(name),
    description: property.description ?? parameterDescriptions[name],
    schema: property
  }))
}

const addContract = (operation: OpenApiOperation): void => {
  const operationId = String(operation.operationId ?? '')
  const registered = contractRegistry[contractRegistryKey] ?? []
  const querySchema =
    querySchemas[operationId] ?? registered.find((item) => item.query?.[operationId])?.query?.[operationId]
  if (querySchema) {
    operation.parameters = [...((operation.parameters ?? []) as unknown[]), ...queryParameters(querySchema)]
  }
  const bodySchema =
    bodySchemas[operationId] ?? registered.find((item) => item.body?.[operationId])?.body?.[operationId]
  if (bodySchema) {
    operation.requestBody = {
      required: true,
      content: { 'application/json': { schema: jsonSchema(bodySchema) } }
    }
  }
  const requestBody = registered.find((item) => item.requestBody?.[operationId])?.requestBody?.[operationId]
  if (requestBody) {
    operation.requestBody = requestBody
  }
}

export const enrichOpenApiContracts = <T extends OpenApiDocument>(document: T): T => {
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      addContract(operation)
    }
  }
  return document
}
