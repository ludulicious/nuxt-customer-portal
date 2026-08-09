import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

export const publicSiteFeature: PortalFeatureDefinition = {
  id: 'public-site',
  navigation: [
    { id: 'blog', labelKey: 'nav.blog', icon: 'i-lucide-book-open', to: '/blog', audiences: ['public'], order: 1 },
    { id: 'contact', labelKey: 'nav.contact', icon: 'i-lucide-mail', to: '/contact', audiences: ['public'], order: 2 }
  ],
  policy: { owner: [], admin: [], member: [] }
}
