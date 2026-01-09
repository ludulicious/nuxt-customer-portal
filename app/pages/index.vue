<script setup lang="ts">
const title = 'Open Source Customer Portal (Nuxt + Nuxt UI)'
const description = 'A free and open source solution for building customer portals with Nuxt 4, Nuxt UI, and a simple single-service backend.'

type TechStackItem = {
  label: string
  description: string
  icon: string
  href: string
  /**
   * Brand color (Simple Icons hex where available).
   * If an icon is black (e.g. Vercel), provide a dark-mode variant too.
   */
  color: string | { light: string, dark: string }
}

const colorMode = useColorMode()

function iconColor(item: TechStackItem) {
  return typeof item.color === 'string'
    ? item.color
    : (colorMode.value === 'dark' ? item.color.dark : item.color.light)
}

const functionalitySections = [
  {
    title: 'Layouts & themes',
    icon: 'i-lucide-layout-template',
    items: [
      'Sign-in and sign-up layout',
      'Admin section layout',
      'Customer section layout',
      'Client-specific styling (colors, fonts, themes)'
    ]
  },
  {
    title: 'Security',
    icon: 'i-lucide-shield-check',
    items: [
      'Sign in / sign up',
      'Multiple login methods (Google, Facebook, X, GitHub, Microsoft, email/password)',
      'Email confirmation flow (email/password)',
      'Forgot password flow (email/password)',
      'Two-factor authentication (authenticator app)'
    ]
  },
  {
    title: 'Admin section',
    icon: 'i-lucide-settings',
    items: [
      'Client management (list, create, update, delete)',
      'User management (list, create, update, delete)',
      'Role & permission management',
      'Custom fields for clients and users'
    ]
  },
  {
    title: 'Customer section',
    icon: 'i-lucide-user',
    items: [
      'Dashboard',
      'Orders list',
      'Invoices list',
      'Pay invoices (Stripe, Polar.sh, and more)',
      'Client-specific pages and data (extensible per customer)'
    ]
  }
]

const techStack: TechStackItem[] = [
  { label: 'Nuxt 4', description: 'Frontend + backend in one project', icon: 'i-simple-icons-nuxtdotjs', href: 'https://nuxt.com/', color: '#00DC82' },
  { label: 'Nuxt UI', description: 'Tailwind CSS + Headless UI', icon: 'i-simple-icons-tailwindcss', href: 'https://ui.nuxt.com/', color: '#06B6D4' },
  { label: 'TypeScript', description: 'Typed end-to-end', icon: 'i-simple-icons-typescript', href: 'https://www.typescriptlang.org/', color: '#3178C6' },
  { label: 'PostgreSQL', description: 'Primary database', icon: 'i-simple-icons-postgresql', href: 'https://www.postgresql.org/', color: '#4169E1' },
  // Neon isn't in our installed Simple Icons set; keep a clean fallback icon but still tint it.
  { label: 'Neon', description: 'Hosted Postgres option', icon: 'i-lucide-database', href: 'https://neon.com/', color: '#00E599' },
  { label: 'Drizzle ORM', description: 'Type-safe ORM', icon: 'i-simple-icons-drizzle', href: 'https://orm.drizzle.team/', color: '#C5F74F' },
  // No Simple Icon found in this repo for better-auth; fallback icon tinted to match the site's cyan accents.
  { label: 'better-auth', description: 'Authentication', icon: 'i-lucide-shield-check', href: 'https://www.better-auth.com/', color: '#00D8FF' },
  { label: 'Docker', description: 'Containerized deployments', icon: 'i-simple-icons-docker', href: 'https://www.docker.com/', color: '#2496ED' },
  { label: 'Vercel', description: 'Edge hosting & deployments', icon: 'i-simple-icons-vercel', href: 'https://vercel.com/', color: { light: '#000000', dark: '#FFFFFF' } }
]

useSeoMeta({
  titleTemplate: '',
  title,
  ogTitle: title,
  description,
  ogDescription: description,
  ogImage: '/logo-no-background.svg',
  twitterImage: '/logo-no-background.svg'
})
</script>

<template>
  <div>
    <UPageHero
      orientation="horizontal"
      :ui="{
        root: 'relative isolate overflow-hidden border-b border-default bg-gradient-to-b from-primary/5 via-transparent to-transparent',
        container: 'py-14 sm:py-20 lg:py-24 gap-10 sm:gap-14 lg:gap-16'
      }"
      :description="description"
    >
      <template #top>
        <StarsBg />
      </template>

      <template #headline>
        <div class="flex flex-wrap items-center gap-2">
          <UBadge
            color="primary"
            variant="subtle"
            class="gap-1"
          >
            <UIcon
              name="i-lucide-sparkles"
              class="size-3.5"
            />
            Free & Open Source
          </UBadge>
          <UBadge
            color="neutral"
            variant="subtle"
            class="gap-1"
          >
            <UIcon
              name="i-lucide-server"
              class="size-3.5"
            />
            Single service
          </UBadge>
          <UBadge
            color="neutral"
            variant="subtle"
            class="gap-1"
          >
            <UIcon
              name="i-lucide-database"
              class="size-3.5"
            />
            PostgreSQL
          </UBadge>
        </div>
      </template>

      <template #title>
        <span>A modern </span>
        <span class="text-primary">Customer Portal</span>
        <span> built with Nuxt, ready to extend.</span>
      </template>

      <template #links>
        <UButton
          to="/getting-started"
          size="xl"
          trailing-icon="i-lucide-arrow-right"
        >
          Get started
        </UButton>

        <UButton
          to="https://github.com/ludulicious/customer-portal"
          target="_blank"
          icon="i-simple-icons-github"
          size="xl"
          color="neutral"
          variant="outline"
        >
          View on GitHub
        </UButton>
      </template>

      <UCard class="rounded-xl shadow-2xl ring ring-default/50 bg-elevated/60 backdrop-blur">
        <div class="space-y-5">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <img
                src="/logo.svg"
                alt="Project logo"
                class="size-6"
              >
              <div class="font-medium">
                Portal blueprint
              </div>
            </div>
            <UBadge
              color="neutral"
              variant="subtle"
            >
              Nuxt 4 + Nuxt UI
            </UBadge>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-lg border border-default bg-default/30 p-4">
              <div class="flex items-center gap-2 font-medium">
                <UIcon
                  name="i-lucide-log-in"
                  class="size-4 text-primary"
                />
                Auth & sessions
              </div>
              <p class="mt-1 text-sm text-muted">
                OAuth providers, email/password, confirmations, resets, and 2FA.
              </p>
            </div>
            <div class="rounded-lg border border-default bg-default/30 p-4">
              <div class="flex items-center gap-2 font-medium">
                <UIcon
                  name="i-lucide-users"
                  class="size-4 text-primary"
                />
                Multi-tenant structure
              </div>
              <p class="mt-1 text-sm text-muted">
                Clear separation between admin and customer experiences.
              </p>
            </div>
            <div class="rounded-lg border border-default bg-default/30 p-4">
              <div class="flex items-center gap-2 font-medium">
                <UIcon
                  name="i-lucide-receipt"
                  class="size-4 text-primary"
                />
                Billing flows
              </div>
              <p class="mt-1 text-sm text-muted">
                Invoices, payments, and provider integrations like Stripe.
              </p>
            </div>
            <div class="rounded-lg border border-default bg-default/30 p-4">
              <div class="flex items-center gap-2 font-medium">
                <UIcon
                  name="i-lucide-plug"
                  class="size-4 text-primary"
                />
                Extensible data
              </div>
              <p class="mt-1 text-sm text-muted">
                Custom fields and client-specific pages as your needs evolve.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span class="text-xs text-muted">
              Built with
            </span>
            <div class="flex flex-wrap items-center gap-2">
              <span
                v-for="item in techStack.slice(0, 6)"
                :key="item.label"
                class="inline-flex items-center gap-1.5 rounded-full border border-default bg-default/30 px-2 py-1 text-xs"
              >
                <UIcon
                  :name="item.icon"
                  class="size-3.5"
                  :style="{ color: iconColor(item) }"
                />
                <span class="text-muted">
                  {{ item.label }}
                </span>
              </span>
            </div>
          </div>
        </div>
      </UCard>
    </UPageHero>

    <UContainer class="py-10 sm:py-14">
      <div class="grid gap-4 sm:grid-cols-3">
        <UPageFeature
          icon="i-lucide-shield-check"
          title="Secure by default"
          description="Multiple login methods, email flows, and 2FA support."
        />
        <UPageFeature
          icon="i-lucide-settings"
          title="Admin-ready"
          description="Clients, users, roles/permissions, and custom fields."
        />
        <UPageFeature
          icon="i-lucide-layout-dashboard"
          title="Customer area"
          description="Dashboards, orders, invoices, and payments integrations."
        />
      </div>
    </UContainer>

    <UContainer class="py-10 sm:py-14">
      <div class="space-y-12">
        <USeparator />

        <section class="space-y-6">
          <div class="space-y-2">
            <h2 class="text-xl sm:text-2xl font-semibold">
              What’s included (functional scope)
            </h2>
            <p class="text-muted max-w-3xl">
              The portal is structured around clear layouts, secure authentication flows, an admin area, and a customer area.
            </p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <UCard
              v-for="section in functionalitySections"
              :key="section.title"
            >
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon
                    :name="section.icon"
                    class="size-5 text-primary"
                  />
                  <span class="font-medium">
                    {{ section.title }}
                  </span>
                </div>
              </template>

              <ul class="list-disc ps-5 space-y-1 text-sm text-muted">
                <li
                  v-for="item in section.items"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </UCard>
          </div>
        </section>

        <USeparator />

        <section class="space-y-6">
          <div class="space-y-2">
            <h2 class="text-xl sm:text-2xl font-semibold">
              Tech stack
            </h2>
            <p class="text-muted max-w-3xl">
              Kept intentionally simple: one service and one database to deploy.
            </p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <UCard
              v-for="item in techStack"
              :key="item.label"
              as="a"
              :href="item.href"
              target="_blank"
              rel="noopener noreferrer"
              class="transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <div class="flex items-start gap-3">
                <div class="shrink-0 rounded-md border border-default bg-elevated p-2">
                  <UIcon
                    :name="item.icon"
                    class="size-5"
                    :style="{ color: iconColor(item) }"
                  />
                </div>
                <div class="space-y-1">
                  <div class="font-medium">
                    {{ item.label }}
                  </div>
                  <div class="text-sm text-muted">
                    {{ item.description }}
                  </div>
                </div>
              </div>
            </UCard>
          </div>
        </section>
      </div>
    </UContainer>
  </div>
</template>
