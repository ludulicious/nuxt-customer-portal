import { registerPortalOpenApiContracts } from '@nuxt-customer-portal/core/server/utils/openapi-contracts'
import { productSchema, listSchema, checkoutSchema, settingsSchema } from '../../shared/validation'

export default defineNitroPlugin(() =>
  registerPortalOpenApiContracts({
    owner: 'products',
    securitySchemes: {
      catalogKey: {
        type: 'http',
        scheme: 'bearer',
        description: 'Secret read-only store API key. Server-to-server use only.'
      }
    },
    query: { storeCatalog: listSchema, storeProduct: listSchema, productsAdminProductsGet: listSchema },
    body: {
      productsAdminProductsPost: productSchema,
      productsAdminProductsByIdPut: productSchema,
      storeCheckoutPost: checkoutSchema,
      productsAdminSettingsPut: settingsSchema
    }
  })
)
