<script setup lang="ts">
const title = 'Customer Portal — an extensible customer portal for Nuxt'
const description =
  'Build from composable Nuxt layers or configure the ready-to-run SaaS portal for your own organization.'

const extensionModel = [
  {
    title: 'Headless core',
    description: 'Sessions, organizations, authorization, database access, and shared server adapters.'
  },
  {
    title: 'Feature registry',
    description:
      'Layers register navigation, module menus, surfaces, dashboard widgets, and role policies without host edits.'
  },
  {
    title: 'Business layers',
    description: 'Each feature owns its UI, API, translations, tests, and PostgreSQL schema.'
  }
]

const workflowStages = [
  {
    number: '01',
    title: 'Configure',
    description: 'Set clients, projects, activities, rates, suppliers, and approval rules.',
    to: '/guides/timesheet-setup'
  },
  {
    number: '02',
    title: 'Record',
    description: 'Enter a working week, use timers, submit time, and correct rejected entries.',
    to: '/guides/time-entry'
  },
  {
    number: '03',
    title: 'Approve',
    description: 'Move weeks through internal review, client approval, and disputes.',
    to: '/guides/approvals'
  },
  {
    number: '04',
    title: 'Invoice',
    description: 'Create drafts from approved time, deliver PDFs, send reminders, and register payments.',
    to: '/guides/invoicing'
  }
]

const ownershipRows = [
  {
    term: 'Core',
    description:
      'Owns headless authentication, organization context, authorization helpers, shared adapters, and the feature contract.'
  },
  {
    term: 'Registry',
    description:
      'Combines installed feature definitions into navigation, module menus, dashboard widgets, and role-aware capabilities.'
  },
  {
    term: 'Feature layer',
    description:
      'Owns one coherent business capability, including routes, types, policies, translations, migrations, and tests.'
  }
]

const contributorPaths = [
  {
    number: '01',
    title: 'Improve the documentation',
    description: 'Correct behavior, add an example, or make a workflow easier to follow.',
    to: '/contributing/documentation'
  },
  {
    number: '02',
    title: 'Create a feature layer',
    description: 'Build a portable module against the public core contracts.',
    to: '/contributing/create-a-layer'
  },
  {
    number: '03',
    title: 'Propose a module',
    description: 'Shape a reusable capability with maintainers before investing in implementation.',
    to: '/contributing/propose-a-module'
  }
]

const techStack = [
  { label: 'Nuxt 4', description: 'Frontend and backend', icon: 'i-simple-icons-nuxtdotjs', href: 'https://nuxt.com/' },
  {
    label: 'Nuxt UI',
    description: 'Tailwind CSS and Reka UI',
    icon: 'i-simple-icons-tailwindcss',
    href: 'https://ui.nuxt.com/'
  },
  {
    label: 'TypeScript',
    description: 'Typed end to end',
    icon: 'i-simple-icons-typescript',
    href: 'https://www.typescriptlang.org/'
  },
  {
    label: 'PostgreSQL',
    description: 'Primary database',
    icon: 'i-simple-icons-postgresql',
    href: 'https://www.postgresql.org/'
  },
  {
    label: 'Drizzle ORM',
    description: 'Type-safe persistence',
    icon: 'i-simple-icons-drizzle',
    href: 'https://orm.drizzle.team/'
  },
  {
    label: 'better-auth',
    description: 'Authentication',
    icon: 'i-simple-icons-betterauth',
    href: 'https://www.better-auth.com/'
  },
  {
    label: 'Docker',
    description: 'Container deployments',
    icon: 'i-simple-icons-docker',
    href: 'https://www.docker.com/'
  },
  {
    label: 'Nuxt i18n',
    description: 'Layer-owned translations',
    icon: 'i-simple-icons-i18next',
    href: 'https://i18n.nuxtjs.org/'
  },
  {
    label: 'VueUse',
    description: 'Composition utilities',
    icon: 'i-simple-icons-vuedotjs',
    href: 'https://vueuse.org/'
  }
]

useSeoMeta({
  titleTemplate: '',
  title,
  ogTitle: title,
  description,
  ogDescription: description,
  ogUrl: 'https://nuxt-customer-portal.com'
})

useHead({
  link: [{ rel: 'canonical', href: 'https://nuxt-customer-portal.com' }]
})

defineOgImage('DocsSatori', {
  headline: 'Composable Nuxt customer portal',
  pageTitle: title,
  pageDescription: description
})
</script>

<template>
  <div class="marketing-home">
    <UContainer class="marketing-hero">
      <div class="marketing-hero-grid">
        <div class="marketing-hero-copy">
          <p class="marketing-kicker">Public development preview</p>
          <h1 class="marketing-display">Build your portal, layer by layer.</h1>
          <p>
            Start with authentication, organizations, administration, and a dashboard. Add business capabilities as
            independent Nuxt layers.
          </p>
          <div class="marketing-actions">
            <UButton
              to="/getting-started"
              size="xl"
              trailing-icon="i-lucide-arrow-right"
              class="marketing-action"
              data-testid="hero-get-started"
            >
              Get started
            </UButton>
            <UButton
              to="https://demo.nuxt-customer-portal.com"
              target="_blank"
              rel="noopener noreferrer"
              size="xl"
              color="neutral"
              variant="outline"
              class="marketing-action"
              data-testid="hero-demo"
            >
              Try the demo
            </UButton>
            <UButton
              to="https://github.com/ludulicious/nuxt-customer-portal"
              target="_blank"
              rel="noopener noreferrer"
              icon="i-simple-icons-github"
              size="xl"
              color="neutral"
              variant="ghost"
              class="marketing-action"
              data-testid="hero-github"
            >
              GitHub
            </UButton>
          </div>
          <div class="licensing-status" role="note" aria-label="Open-source license">
            <UIcon name="i-lucide-scale" class="size-4 shrink-0" aria-hidden="true" />
            <p>
              Nuxt Customer Portal is open source under the MIT License.
              <NuxtLink to="/reference/compatibility-and-releases">Read compatibility and release status</NuxtLink>.
            </p>
          </div>
        </div>

        <section class="extension-map" aria-labelledby="extension-model-title">
          <header class="extension-map-header">
            <span id="extension-model-title">The extension model</span>
            <span>Nuxt 4</span>
          </header>
          <ol>
            <li v-for="(item, index) in extensionModel" :key="item.title">
              <span class="extension-map-index">0{{ index + 1 }}</span>
              <div>
                <h2>{{ item.title }}</h2>
                <p>{{ item.description }}</p>
              </div>
            </li>
          </ol>
        </section>
      </div>
    </UContainer>

    <section class="hosted-evaluation" aria-labelledby="hosted-evaluation-title">
      <UContainer class="hosted-evaluation-grid">
        <div>
          <p class="marketing-kicker">Hosted evaluation</p>
          <h2 id="hosted-evaluation-title" class="marketing-display">See your own portal take shape.</h2>
          <p>
            The new SaaS portal is a ready-to-run application that your organization can configure with its own
            branding, modules, homepage content, support details, and legal pages. Request a hosted evaluation version
            at PortalNuxt—no local installation required.
          </p>
        </div>
        <UButton
          to="https://portalnuxt.com"
          target="_blank"
          rel="noopener noreferrer"
          size="xl"
          trailing-icon="i-lucide-arrow-up-right"
          class="marketing-action hosted-evaluation-action"
          data-testid="hosted-evaluation-cta"
        >
          Request a hosted evaluation
        </UButton>
      </UContainer>
    </section>

    <section class="workflow-band" aria-labelledby="workflow-title">
      <UContainer>
        <div class="workflow-intro">
          <h2 id="workflow-title" class="marketing-display">A working week, end to end.</h2>
          <p>
            Timesheets and invoices are used in real Customer Portal deployments. The module covers the complete path
            from workspace configuration to a paid invoice—not a disconnected feature demo.
          </p>
        </div>
        <ol class="workflow-sequence">
          <li v-for="stage in workflowStages" :key="stage.number">
            <NuxtLink :to="stage.to" class="workflow-stage">
              <span class="workflow-stage-number">{{ stage.number }}</span>
              <h3>{{ stage.title }}</h3>
              <p>{{ stage.description }}</p>
              <span class="workflow-stage-arrow" aria-hidden="true">→</span>
            </NuxtLink>
          </li>
        </ol>
      </UContainer>
    </section>

    <section class="marketing-section" aria-labelledby="platform-title">
      <UContainer class="platform-grid">
        <header class="section-heading">
          <h2 id="platform-title" class="marketing-display">Core stays stable. Features own their work.</h2>
          <p>The host composes capabilities. It does not need to know their implementation details.</p>
        </header>
        <div>
          <dl class="ownership-list">
            <div v-for="row in ownershipRows" :key="row.term">
              <dt>{{ row.term }}</dt>
              <dd>{{ row.description }}</dd>
            </div>
          </dl>
          <div class="platform-links">
            <NuxtLink to="/architecture/layers" class="marketing-link">
              Understand feature layers <span aria-hidden="true">→</span>
            </NuxtLink>
            <NuxtLink to="/reference/feature-contract" class="marketing-link">
              Read the feature contract <span aria-hidden="true">→</span>
            </NuxtLink>
          </div>
        </div>
      </UContainer>
    </section>

    <section class="contributor-section" aria-labelledby="contributor-title">
      <UContainer class="contributor-grid">
        <div class="contributor-copy">
          <h2 id="contributor-title" class="marketing-display">Help shape the portal.</h2>
          <p>
            You do not need to start with a large pull request. A precise documentation correction, a failing
            authorization test, or a focused layer proposal can move the project forward.
          </p>
          <NuxtLink to="/contributing" class="marketing-link">
            Contribution guide <span aria-hidden="true">→</span>
          </NuxtLink>
        </div>
        <ol class="contributor-paths">
          <li v-for="path in contributorPaths" :key="path.number">
            <NuxtLink :to="path.to" class="contributor-path">
              <span>{{ path.number }}</span>
              <span>
                <strong>{{ path.title }}</strong>
                <small>{{ path.description }}</small>
              </span>
              <span aria-hidden="true">→</span>
            </NuxtLink>
          </li>
        </ol>
      </UContainer>
    </section>

    <section class="technology-colophon" aria-labelledby="technology-title">
      <UContainer>
        <header class="technology-header">
          <h2 id="technology-title">Technology</h2>
          <p>One Nuxt service and one PostgreSQL database.</p>
        </header>
        <ul class="technology-list">
          <li v-for="item in techStack" :key="item.label">
            <a :href="item.href" target="_blank" rel="noopener noreferrer">
              <UIcon :name="item.icon" class="size-5" />
              <span>
                <strong>{{ item.label }}</strong>
                <span>{{ item.description }}</span>
              </span>
            </a>
          </li>
        </ul>
      </UContainer>
    </section>
  </div>
</template>
