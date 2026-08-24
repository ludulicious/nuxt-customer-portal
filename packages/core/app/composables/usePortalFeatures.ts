import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'
import {
  mergePortalModuleMenuContributions,
  sortPortalDashboardWidgets,
  upsertPortalFeature
} from '@nuxt-customer-portal/core/shared/feature-registry'

export const usePortalFeatures = () => {
  const features = useState<PortalFeatureDefinition[]>('portal-features', () => [])
  const enabledModules = useState<string[] | null>('portal-enabled-modules', () => null)

  const featureEnabled = (feature: PortalFeatureDefinition) => {
    if (!enabledModules.value) {
      return true
    }
    if (!['timesheets', 'invoices', 'service-requests', 'invoice-timesheets'].includes(feature.id)) {
      return true
    }
    return enabledModules.value.includes(feature.id)
  }

  const registerFeature = (feature: PortalFeatureDefinition) => {
    features.value = upsertPortalFeature(features.value, feature)
  }

  const navigation = computed(() =>
    features.value
      .filter(featureEnabled)
      .flatMap((feature) => feature.navigation ?? [])
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  )

  const dashboardWidgets = computed(() =>
    sortPortalDashboardWidgets(
      features.value.filter(featureEnabled).flatMap((feature) => feature.dashboardWidgets ?? [])
    )
  )

  const modules = computed(() => {
    const enabledFeatures = features.value.filter(featureEnabled)
    return mergePortalModuleMenuContributions(
      enabledFeatures.flatMap((feature) => feature.modules ?? []),
      enabledFeatures.flatMap((feature) => feature.moduleMenuItems ?? [])
    ).sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  })

  const surfaces = computed(() =>
    features.value
      .filter(featureEnabled)
      .flatMap((feature) => feature.surfaces ?? [])
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id))
  )

  const contributionsFor = (surface: string) =>
    computed(() => surfaces.value.filter((contribution) => contribution.surface === surface))

  const clientIntegrations = computed(() =>
    features.value
      .filter(featureEnabled)
      .flatMap((feature) => (feature.clientIntegration ? [feature.clientIntegration] : []))
      .sort((left, right) => left.moduleId.localeCompare(right.moduleId))
  )

  return {
    features: readonly(features),
    navigation,
    modules,
    dashboardWidgets,
    surfaces,
    clientIntegrations,
    contributionsFor,
    registerFeature
  }
}
