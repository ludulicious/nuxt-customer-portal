import { z } from 'zod'

type RouteMetaInput = {
  openAPI: Record<string, unknown>
  query?: z.ZodType
  body?: z.ZodType
}

const jsonSchema = (schema: z.ZodType): Record<string, unknown> => {
  const result = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>
  delete result.$schema
  return result
}

export const definePortalRouteMeta = ({ openAPI, query, body }: RouteMetaInput) => ({
  openAPI: {
    ...openAPI,
    ...(query ? { parameters: [{ in: 'query', schema: jsonSchema(query) }] } : {}),
    ...(body
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: jsonSchema(body) } }
          }
        }
      : {})
  }
})
