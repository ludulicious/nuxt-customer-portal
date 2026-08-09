<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

const { locale, t } = useI18n()
const userStore = useUserStore()
const { currentUser } = storeToRefs(userStore)

const loadHomePage = () => locale.value === 'nl'
  ? queryCollection('index_nl').first()
  : queryCollection('index_en').first()

const { data: page } = await useAsyncData(
  'home-page',
  loadHomePage,
  { watch: [locale] }
)

const title = computed(() => page.value?.seo?.title || page.value?.title || '')
const description = computed(() => page.value?.seo?.description || page.value?.description || '')
const isLoggedIn = computed(() => currentUser.value !== null)

// Dynamic hero links based on login status
const heroLinks = computed<ButtonProps[]>(() => {
  if (isLoggedIn.value) {
    return [
      {
        label: t('home.links.dashboard'),
        icon: 'i-lucide-layout-dashboard',
        to: '/dashboard',
        size: 'xl',
        color: 'primary' as const
      }
    ]
  }
  return page.value?.hero?.links || []
})

// Dynamic CTA links based on login status
const ctaLinks = computed<ButtonProps[]>(() => {
  if (isLoggedIn.value) {
    return [
      {
        label: t('home.links.dashboard'),
        to: '/dashboard',
        color: 'primary' as const,
        icon: 'i-lucide-layout-dashboard'
      }
    ]
  }
  return page.value?.cta?.links || []
})

useSeoMeta({
  titleTemplate: '',
  title,
  ogTitle: title,
  description,
  ogDescription: description
})
definePageMeta({
  public: true,
  layout: 'portal'
})
</script>

<template>
  <div class="public-home">
    <div v-if="page">
      <UPageHero v-if="page.hero" :title="page.title" :description="page.description" :links="heroLinks"
        class="py-2 md:py-4 mb-0">
        <template #top>
          <HeroBackground />
        </template>

        <template #title>
          <MDC :value="page.title" unwrap="p" />
        </template>
        <div class="relative flex justify-center items-center">
          <NuxtImg src="/images/home/office.png" alt="Our fake office" class="public-home-hero-image rounded-lg" height="600" width="1200" />
        </div>
      </UPageHero>

      <UPageSection v-if="page.features" :title="page.features.title" :description="page.features.description"
        class="mt-0">
        <UPageGrid>
          <UPageCard v-for="(item, index) in page.features.items" :key="index" v-bind="item" spotlight />
        </UPageGrid>
      </UPageSection>

      <UPageSection v-if="page.testimonials" id="testimonials" :headline="page.testimonials.headline"
        :title="page.testimonials.title" :description="page.testimonials.description">
        <UPageColumns class="xl:columns-4">
          <UPageCard v-for="(testimonial, index) in page.testimonials.items" :key="index" variant="subtle"
            :description="testimonial.quote"
            :ui="{ description: 'before:content-[open-quote] after:content-[close-quote]' }">
            <template #footer>
              <UUser v-bind="testimonial.user" size="lg" />
            </template>
          </UPageCard>
        </UPageColumns>
      </UPageSection>

      <USeparator />

      <UPageCTA v-bind="{ ...page.cta, links: ctaLinks }" variant="naked" class="overflow-hidden">
        <LazyStarsBg />
      </UPageCTA>
    </div>
    <UPageSection v-else :title="t('common.error')" description="The homepage content could not be loaded." />
  </div>
</template>
