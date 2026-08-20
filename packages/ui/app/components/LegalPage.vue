<script setup lang="ts">
defineProps<{
  title: string
  description: string
  children: Array<{
    title: string
    paragraphs?: string[]
    items?: string[]
  }>
}>()
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPage class="mx-auto max-w-3xl">
      <UPageHeader :title="title" :description="description" />

      <div class="prose prose-neutral dark:prose-invert mt-10 max-w-none">
        <p>Effective date: January 15, 2026</p>

        <section v-for="section in children" :key="section.title" class="mt-8">
          <h2>{{ section.title }}</h2>
          <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
          <ul v-if="section.items?.length">
            <li v-for="item in section.items" :key="item">{{ item }}</li>
          </ul>
        </section>
      </div>
    </UPage>
  </UContainer>
</template>
