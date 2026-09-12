import { registerPortalOpenApiContracts } from '@nuxt-customer-portal/core/server/utils/openapi-contracts'
import { apiKeySchema } from '../../shared/api-key'

export default defineNitroPlugin(() =>
  registerPortalOpenApiContracts({
    owner: 'administration',
    body: { adminApiKeysPost: apiKeySchema }
  })
)
