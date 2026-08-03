import type { PortalFeatureDefinition } from '#layers/portal-core/shared/types/feature'
import { upsertPortalFeature } from '#layers/portal-core/shared/feature-registry'

export const usePortalFeatures = () => {
  const features = useState<PortalFeatureDefinition[]>('portal-features', () => [])

  const registerFeature = (feature: PortalFeatureDefinition) => {
    features.value = upsertPortalFeature(features.value, feature)
  }

  const navigation = computed(() => features.value
    .flatMap(feature => feature.navigation ?? [])
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100)))

  const dashboardWidgets = computed(() => features.value
    .flatMap(feature => feature.dashboardWidgets ?? [])
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100)))

  return {
    features: readonly(features),
    navigation,
    dashboardWidgets,
    registerFeature
  }
}
