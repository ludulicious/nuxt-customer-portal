import { productsFeature } from '@nuxt-customer-portal/products/shared/feature'

export default defineNuxtPlugin(() => {
  const { registerFeature } = usePortalFeatures()
  const { activeOrganizationType, activeOrganizationRole } = usePortalSession()
  watch(
    [activeOrganizationType, activeOrganizationRole],
    ([type, role]) => {
      const managesStore = type === 'PROVIDER' && (role === 'owner' || role === 'admin')
      registerFeature({
        ...productsFeature,
        modules: productsFeature.modules?.map((module) => ({
          ...module,
          to: managesStore ? '/admin/products' : '/purchases'
        }))
      })
    },
    { immediate: true }
  )
})
