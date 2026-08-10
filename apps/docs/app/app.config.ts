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
    siteName: 'Customer Portal'
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
      'to': 'https://github.com/ludulicious/nuxt-customer-portal',
      'target': '_blank',
      'aria-label': 'Customer Portal on GitHub'
    }]
  },
  footer: {
    credits: `Customer Portal • public development • © ${new Date().getFullYear()}`,
    colorMode: false,
    links: [{
      label: 'Contribute',
      to: '/contributing'
    }, {
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
      links: [{
        icon: 'i-lucide-star',
        label: 'Star on GitHub',
        to: 'https://github.com/ludulicious/nuxt-customer-portal',
        target: '_blank'
      }, {
        icon: 'i-lucide-blocks',
        label: 'Create a feature layer',
        to: '/contributing/create-a-layer'
      }]
    }
  }
})
