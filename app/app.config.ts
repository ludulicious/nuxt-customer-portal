export default defineAppConfig({
  ui: {
    colors: {
      primary: 'primary',
      secondary: 'secondary',
      neutral: 'slate'
    },
    footer: {
      slots: {
        root: 'border-t border-default',
        left: 'text-sm text-muted'
      }
    }
  },
  seo: {
    siteName: 'PortalNuxt Documentation'
  },
  header: {
    title: '',
    to: '/',
    logo: {
      alt: '',
      light: '',
      dark: ''
    },
    search: true,
    colorMode: true,
    links: [{
      'icon': 'i-simple-icons-github',
      'to': 'https://github.com/ludulicious/customer-portal',
      'target': '_blank',
      'aria-label': 'GitHub'
    }]
  },
  footer: {
    credits: `Built with Nuxt UI • © ${new Date().getFullYear()}`,
    colorMode: false,
    links: [{
      label: 'Privacy Policy',
      to: '/privacy-policy'
    }, {
      label: 'Terms of Service',
      to: '/terms-of-service'
    }]
  },
  toc: {
    title: 'Table of Contents',
    bottom: {
      title: 'Community',
      edit: 'https://github.com/ludulicious/portalnuxt/edit/main/content',
      links: [{
        icon: 'i-lucide-star',
        label: 'Star on GitHub',
        to: 'https://github.com/ludulicious/portalnuxt',
        target: '_blank'
      }, {
        icon: 'i-lucide-book-open',
        label: 'Nuxt UI docs',
        to: 'https://ui.nuxt.com/docs/getting-started/installation/nuxt',
        target: '_blank'
      }]
    }
  }
})
