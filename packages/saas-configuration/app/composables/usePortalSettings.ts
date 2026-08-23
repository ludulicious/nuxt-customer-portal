import type { PortalOnboardingState, PortalSettings } from '../../shared/settings'

export interface PublicPortalSettings extends Pick<PortalSettings, 'branding' | 'appearance' | 'enabledModules' | 'content'> { completed: boolean }

export const usePortalSettings = () => {
  const settings = useState<PublicPortalSettings | null>('portal-runtime-settings', () => null)
  const enabledModules = useState<string[] | null>('portal-enabled-modules', () => null)
  const bootstrap = useState<PortalOnboardingState | null>('portal-bootstrap-state', () => null)

  const refreshPublicSettings = async () => {
    settings.value = await $fetch<PublicPortalSettings>('/api/portal/public')
    enabledModules.value = settings.value.enabledModules
    return settings.value
  }
  const refreshBootstrap = async () => {
    bootstrap.value = await $fetch<PortalOnboardingState>('/api/portal/bootstrap')
    return bootstrap.value
  }
  return { settings, bootstrap, enabledModules, refreshPublicSettings, refreshBootstrap }
}
