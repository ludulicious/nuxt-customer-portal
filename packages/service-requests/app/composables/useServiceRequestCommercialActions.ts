import type { ServiceRequest, ServiceRequestQuoteDto } from '@nuxt-customer-portal/service-requests/shared/types/service-request'

export interface ServiceRequestCommercialAction {
  id: string
  label: string
  icon: string
  available: (request: ServiceRequest, quote: ServiceRequestQuoteDto) => boolean
  run: (request: ServiceRequest, quote: ServiceRequestQuoteDto) => Promise<{ to?: string } | undefined>
}
export const useServiceRequestCommercialActions = () => {
  const actions = useState<ServiceRequestCommercialAction[]>('service-request-commercial-actions', () => [])
  const register = (action: ServiceRequestCommercialAction) => {
    actions.value = [...actions.value.filter((item) => item.id !== action.id), action]
  }
  return { actions: readonly(actions), register }
}
