import { auth } from '../../utils/auth'
import { mergeBetterAuthOpenApi } from '../../utils/openapi-auth'
import { enrichOpenApiContracts } from '../../utils/openapi-contracts'
import { orderOpenApiDocument, type OpenApiDocument } from '../../utils/openapi-order'

defineRouteMeta({
  openAPI: {
    tags: ['Internal'],
    summary: 'Get the ordered OpenAPI document',
    description:
      'Returns the generated OpenAPI document in a stable, domain-oriented order for the documentation interfaces.',
    'x-scalar-ignore': true
  }
})

export default defineEventHandler(async (event) => {
  const document = await event.$fetch<OpenApiDocument>('/api-docs/openapi.raw.json')
  const authDocument = (await auth.api.generateOpenAPISchema()) as unknown as OpenApiDocument
  return orderOpenApiDocument(enrichOpenApiContracts(mergeBetterAuthOpenApi(document, authDocument)))
})
