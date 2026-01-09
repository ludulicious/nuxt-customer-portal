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
  <UContainer class="py-10 sm:py-14">
    <div class="space-y-12">
      <section class="space-y-5">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge color="primary" variant="subtle">
            Free & Open Source
          </UBadge>
          <UBadge color="neutral" variant="subtle">
            Nuxt 4
          </UBadge>
          <UBadge color="neutral" variant="subtle">
            Nuxt UI
          </UBadge>
        </div>

        <h1 class="text-3xl sm:text-4xl font-semibold tracking-tight">
          Build a customer portal that’s easy to deploy and easy to extend.
        </h1>

        <p class="text-base sm:text-lg text-muted max-w-3xl">
          This site documents a free and open source customer portal solution: a single Nuxt project (frontend + backend),
          designed to be accessible to smaller teams while still scaling to larger organizations.
        </p>

        <div class="flex flex-wrap gap-3">
          <UButton
            to="/getting-started"
            size="lg"
            trailing-icon="i-lucide-arrow-right"
          >
            Get started
          </UButton>
          <UButton
            to="/essentials"
            size="lg"
            color="neutral"
            variant="outline"
          >
            Browse docs
          </UButton>
        </div>
      </section>

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
</template>
