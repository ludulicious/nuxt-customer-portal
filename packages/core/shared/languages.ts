/** Languages with bundled portal interface translations. */
export const portalLanguageCodes = ['en', 'nl'] as const
export type PortalLanguage = (typeof portalLanguageCodes)[number]
export const portalLanguages = [
  { value: 'en' as const, label: '🇺🇸 English' },
  { value: 'nl' as const, label: '🇳🇱 Nederlands' }
]
