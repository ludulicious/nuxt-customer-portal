import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'
import {
  isPortalFeatureEnabled,
  mergePortalModuleMenuContributions,
  sortPortalDashboardWidgets,
  upsertPortalFeature
} from '@nuxt-customer-portal/core/shared/feature-registry'

export const usePortalFeatures = () => {
  const features = useState<PortalFeatureDefinition[]>('portal-features', () => [])
  const enabledModules = useState<string[] | null>('portal-enabled-modules', () => null)

  const enabledFeatures = computed(() =>
    features.value.filter((feature) => isPortalFeatureEnabled(feature, enabledModules.value))
  )

  const registerFeature = (feature: PortalFeatureDefinition) => {
    features.value = upsertPortalFeature(features.value, feature)
  }

  const navigation = computed(() =>
    enabledFeatures.value
      .flatMap((feature) => feature.navigation ?? [])
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  )

  const dashboardWidgets = computed(() =>
    sortPortalDashboardWidgets(enabledFeatures.value.flatMap((feature) => feature.dashboardWidgets ?? []))
  )

  const modules = computed(() => {
    return mergePortalModuleMenuContributions(
      enabledFeatures.value.flatMap((feature) => feature.modules ?? []),
      enabledFeatures.value.flatMap((feature) => feature.moduleMenuItems ?? [])
    ).sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  })

  const surfaces = computed(() =>
    enabledFeatures.value
      .flatMap((feature) => feature.surfaces ?? [])
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id))
  )

  const contributionsFor = (surface: string) =>
    computed(() => surfaces.value.filter((contribution) => contribution.surface === surface))

  const clientIntegrations = computed(() =>
    enabledFeatures.value
      .flatMap((feature) => (feature.clientIntegration ? [feature.clientIntegration] : []))
      .sort((left, right) => left.moduleId.localeCompare(right.moduleId))
  )

  return {
    features: readonly(features),
    enabledFeatures: readonly(enabledFeatures),
    navigation,
    modules,
    dashboardWidgets,
    surfaces,
    clientIntegrations,
    contributionsFor,
    registerFeature
  }
}
