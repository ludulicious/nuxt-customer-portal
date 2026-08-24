import type { OpenApiDocument } from './openapi-order'

type OpenApiObject = Record<string, unknown>

const AUTH_TAG = 'Authentication'
const AUTH_PATH_PREFIX = '/api/auth'

const mergeObjects = (left: unknown, right: unknown): OpenApiObject => ({
  ...(left as OpenApiObject | undefined),
  ...(right as OpenApiObject | undefined)
})

const prefixAuthPath = (path: string): string => `${AUTH_PATH_PREFIX}${path.startsWith('/') ? path : `/${path}`}`

const tagAuthenticationOperations = (pathItem: OpenApiObject): OpenApiObject =>
  Object.fromEntries(
    Object.entries(pathItem).map(([method, value]) => {
      if (!value || typeof value !== 'object' || method === 'parameters') {
        return [method, value]
      }
      return [
        method,
        {
          ...(value as OpenApiObject),
          tags: [AUTH_TAG]
        }
      ]
    })
  )

export const mergeBetterAuthOpenApi = (document: OpenApiDocument, authDocument: OpenApiDocument): OpenApiDocument => {
  const components = mergeObjects(document.components, authDocument.components)
  components.schemas = mergeObjects(
    (document.components as OpenApiObject | undefined)?.schemas,
    (authDocument.components as OpenApiObject | undefined)?.schemas
  )
  components.securitySchemes = mergeObjects(
    (document.components as OpenApiObject | undefined)?.securitySchemes,
    (authDocument.components as OpenApiObject | undefined)?.securitySchemes
  )

  const authPaths = Object.fromEntries(
    Object.entries(authDocument.paths ?? {}).map(([path, pathItem]) => [
      prefixAuthPath(path),
      tagAuthenticationOperations(pathItem)
    ])
  )

  const tags = Array.isArray(document.tags) ? document.tags : []

  return {
    ...document,
    components,
    tags: [
      {
        name: AUTH_TAG,
        description:
          'Authentication, session, account, administration, email verification, and organization membership endpoints provided by Better Auth.'
      },
      ...tags.filter((tag) => (tag as OpenApiObject)?.name !== AUTH_TAG)
    ],
    paths: {
      ...document.paths,
      ...authPaths
    } as OpenApiDocument['paths']
  }
}
