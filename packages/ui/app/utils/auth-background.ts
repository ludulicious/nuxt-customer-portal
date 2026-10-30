export interface AuthBackgroundBranding {
  authBackgroundDesktop?: string
  authBackgroundMobile?: string
}

export function resolveAuthBackgrounds(branding?: AuthBackgroundBranding | null) {
  return {
    desktop: branding?.authBackgroundDesktop || branding?.authBackgroundMobile || '',
    mobile: branding?.authBackgroundMobile || branding?.authBackgroundDesktop || ''
  }
}
