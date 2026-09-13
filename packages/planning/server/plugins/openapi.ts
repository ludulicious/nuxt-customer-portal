import { productPlanningSchema } from '@nuxt-customer-portal/products/shared/planning'
import { registerPortalOpenApiContracts } from '@nuxt-customer-portal/core/server/utils/openapi-contracts'
import { z } from 'zod'
import {
  availabilityQuerySchema,
  availabilitySchema,
  availabilityEditSchema,
  providerSettingsSchema,
  holdSchema,
  holdCredentialSchema,
  planningPolicySchema
} from '../../shared/validation'

export default defineNitroPlugin(() =>
  registerPortalOpenApiContracts({
    owner: 'planning',
    query: {
      storePlanningByProductIdAvailabilityGet: availabilityQuerySchema,
      storePlanningHoldGet: holdCredentialSchema,
      planningAppointmentsByIdAvailabilityGet: availabilityQuerySchema
    },
    body: {
      storePlanningHoldsPost: holdSchema,
      planningAdminProductsByIdPut: productPlanningSchema,
      planningProviderPut: providerSettingsSchema,
      planningAvailabilityPost: availabilitySchema,
      planningAvailabilityByIdPut: availabilityEditSchema,
      planningAdminPolicyPut: planningPolicySchema,
      planningAdminProvidersByUserIdPatch: z.object({ enabled: z.boolean() })
    }
  })
)
