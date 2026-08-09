import { registerPortalOpenApiContracts } from '@nuxt-customer-portal/core/server/utils/openapi-contracts'
import {
  adminUpdateServiceRequestSchema,
  createServiceRequestSchema,
  filterServiceRequestSchema,
  updateServiceRequestSchema
} from '../utils/service-request-validation'

export default defineNitroPlugin(() => {
  registerPortalOpenApiContracts({
    owner: 'service-requests',
    query: {
      serviceRequestsGet: filterServiceRequestSchema,
      serviceRequestsAdminGet: filterServiceRequestSchema
    },
    body: {
      serviceRequestsPost: createServiceRequestSchema,
      serviceRequestsByIdPatch: updateServiceRequestSchema,
      serviceRequestsAdminByIdPatch: adminUpdateServiceRequestSchema
    }
  })
})
