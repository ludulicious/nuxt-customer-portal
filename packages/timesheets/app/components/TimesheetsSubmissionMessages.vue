<script setup lang="ts">
import type { SubmissionMessageDto } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

defineProps<{ messages: readonly Readonly<SubmissionMessageDto>[] }>()
const { locale } = useI18n()
const userStore = useUserStore()
const timestamp = (value: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
</script>

<template>
  <div v-if="messages.length" class="my-3 flex w-full max-w-4xl flex-col gap-3">
    <article
      v-for="message in messages"
      :key="message.id"
      class="w-fit min-w-0 max-w-[92%] rounded-2xl border p-3 text-default sm:max-w-[80%]"
      :class="
        message.authorUserId && message.authorUserId === userStore.currentUser?.id
          ? 'self-end rounded-br-sm border-primary/25 bg-primary/10'
          : 'self-start rounded-bl-sm border-default bg-elevated'
      "
    >
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <span v-if="message.authorName" class="text-sm font-medium">{{ message.authorName }}</span>
        <time :datetime="message.createdAt" class="text-xs text-muted">{{ timestamp(message.createdAt) }}</time>
      </div>
      <p class="whitespace-pre-line break-words text-sm leading-relaxed">{{ message.comment }}</p>
    </article>
  </div>
</template>
