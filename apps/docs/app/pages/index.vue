<script setup lang="ts">
const { data: landing } = await useAsyncData('landing', () => queryCollection('landing').first())

if (!landing.value) {
  throw createError({ statusCode: 404, statusMessage: 'Homepage content not found' })
}

const page = computed(() => landing.value!)

useSeoMeta({
  titleTemplate: '',
  title: () => page.value.seo.title,
  ogTitle: () => page.value.seo.title,
  description: () => page.value.seo.description,
  ogDescription: () => page.value.seo.description,
  ogUrl: 'https://nuxt-customer-portal.com'
})

useHead({
  link: [{ rel: 'canonical', href: 'https://nuxt-customer-portal.com' }]
})

defineOgImage('DocsSatori', {
  headline: page.value.seo.headline,
  pageTitle: page.value.seo.title,
  pageDescription: page.value.seo.description
})
</script>

<template>
  <div class="marketing-home">
    <UContainer class="marketing-hero">
      <div class="marketing-hero-grid">
        <div class="marketing-hero-copy">
          <p class="marketing-kicker">{{ page.hero.kicker }}</p>
          <h1 class="marketing-display">{{ page.hero.title }}</h1>
          <p>{{ page.hero.description }}</p>
          <div class="marketing-actions">
            <UButton
              v-for="action in page.hero.actions"
              :key="action.label"
              :to="action.to"
              :target="action.external ? '_blank' : undefined"
              :rel="action.external ? 'noopener noreferrer' : undefined"
              :icon="action.icon"
              :trailing-icon="action.trailingIcon"
              size="xl"
              :color="action.variant === 'solid' ? 'primary' : 'neutral'"
              :variant="action.variant"
              class="marketing-action"
              :data-testid="action.testId"
            >
              {{ action.label }}
            </UButton>
          </div>
          <div class="licensing-status" role="note" aria-label="Open-source license">
            <UIcon name="i-lucide-scale" class="size-4 shrink-0" aria-hidden="true" />
            <p>
              {{ page.hero.license.text }}
              <NuxtLink :to="page.hero.license.linkTo">{{ page.hero.license.linkLabel }}</NuxtLink>.
            </p>
          </div>
        </div>

        <section class="extension-map" aria-labelledby="extension-model-title">
          <header class="extension-map-header">
            <span id="extension-model-title">{{ page.extensionModel.title }}</span>
            <span>{{ page.extensionModel.badge }}</span>
          </header>
          <ol>
            <li v-for="(item, index) in page.extensionModel.items" :key="item.title">
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
          <p class="marketing-kicker">{{ page.hostedEvaluation.kicker }}</p>
          <h2 id="hosted-evaluation-title" class="marketing-display">{{ page.hostedEvaluation.title }}</h2>
          <p>{{ page.hostedEvaluation.description }}</p>
        </div>
        <UButton
          :to="page.hostedEvaluation.action.to"
          target="_blank"
          rel="noopener noreferrer"
          size="xl"
          trailing-icon="i-lucide-arrow-up-right"
          class="marketing-action hosted-evaluation-action"
          data-testid="hosted-evaluation-cta"
        >
          {{ page.hostedEvaluation.action.label }}
        </UButton>
      </UContainer>
    </section>

    <section class="workflow-band" aria-labelledby="workflow-title">
      <UContainer>
        <div class="workflow-intro">
          <h2 id="workflow-title" class="marketing-display">{{ page.workflow.title }}</h2>
          <p>{{ page.workflow.description }}</p>
        </div>
        <ol class="workflow-sequence">
          <li v-for="stage in page.workflow.stages" :key="stage.number">
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
          <h2 id="platform-title" class="marketing-display">{{ page.platform.title }}</h2>
          <p>{{ page.platform.description }}</p>
        </header>
        <div>
          <dl class="ownership-list">
            <div v-for="row in page.platform.ownership" :key="row.term">
              <dt>{{ row.term }}</dt>
              <dd>{{ row.description }}</dd>
            </div>
          </dl>
          <div class="platform-links">
            <NuxtLink v-for="link in page.platform.links" :key="link.to" :to="link.to" class="marketing-link">
              {{ link.label }} <span aria-hidden="true">→</span>
            </NuxtLink>
          </div>
        </div>
      </UContainer>
    </section>

    <section class="contributor-section" aria-labelledby="contributor-title">
      <UContainer class="contributor-grid">
        <div class="contributor-copy">
          <h2 id="contributor-title" class="marketing-display">{{ page.contributors.title }}</h2>
          <p>{{ page.contributors.description }}</p>
          <NuxtLink :to="page.contributors.link.to" class="marketing-link">
            {{ page.contributors.link.label }} <span aria-hidden="true">→</span>
          </NuxtLink>
        </div>
        <ol class="contributor-paths">
          <li v-for="path in page.contributors.paths" :key="path.number">
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
          <h2 id="technology-title">{{ page.technology.title }}</h2>
          <p>{{ page.technology.description }}</p>
        </header>
        <ul class="technology-list">
          <li v-for="item in page.technology.items" :key="item.label">
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
