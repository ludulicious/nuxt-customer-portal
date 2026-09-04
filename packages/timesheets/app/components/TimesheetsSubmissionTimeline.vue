<script setup lang="ts">
import type { SubmissionHistoryEventDto } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

defineProps<{ events: readonly Readonly<SubmissionHistoryEventDto>[] }>()
const { t, locale } = useI18n()
const userStore = useUserStore()
const isOwnEvent = (event: Readonly<SubmissionHistoryEventDto>) =>
  !!event.actorUserId && event.actorUserId === userStore.currentUser?.id
const formatHistoryDate = (date: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
</script>

<template>
  <section v-if="events?.length" class="border-t border-default pt-3">
    <ol
      class="relative w-full space-y-4 py-2 text-sm before:absolute before:inset-y-0 before:left-2 before:w-px before:bg-accented sm:before:left-1/2"
    >
      <li
        v-for="event in events"
        :key="event.id"
        class="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)]"
      >
        <span
          class="z-10 col-start-1 row-start-1 mt-4 size-4 rounded-full border-4 border-default sm:col-start-2"
          :class="
            event.action === 'APPROVED'
              ? 'bg-success'
              : ['REJECTED', 'DISPUTED'].includes(event.action)
                ? 'bg-error'
                : ['SUBMITTED', 'CLIENT_SUBMITTED'].includes(event.action)
                  ? 'bg-primary'
                  : 'bg-warning'
          "
          aria-hidden="true"
        />
        <div
          class="col-start-2 row-start-1 rounded-lg border p-3"
          :class="
            isOwnEvent(event)
              ? 'border-primary/25 bg-primary/10 sm:col-start-3'
              : 'border-default bg-elevated sm:col-start-1 sm:text-right'
          "
        >
          <div
            class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
            :class="!isOwnEvent(event) ? 'sm:justify-end' : ''"
          >
            <p
              class="shrink-0 font-medium"
              :class="
                event.action === 'APPROVED'
                  ? 'text-success'
                  : ['REJECTED', 'DISPUTED'].includes(event.action)
                    ? 'text-error'
                    : 'text-default'
              "
            >
              {{ t(`features.timesheets.submissions.events.${event.action}`) }}
            </p>
            <div class="flex items-center gap-1.5 text-default">
              <UAvatar :src="event.actorImage ?? undefined" :alt="event.actorName ?? undefined" size="xs" />
              <span
                >{{ event.actorName }}<template v-if="event.clientName"> · {{ event.clientName }}</template></span
              >
            </div>
            <time :datetime="event.createdAt" class="shrink-0 text-xs text-muted">{{
              formatHistoryDate(event.createdAt)
            }}</time>
          </div>
          <blockquote
            v-if="event.comment"
            class="mt-3 rounded-r-md border-l-2 bg-default/50 px-3 py-2 text-left italic text-default"
            :class="
              event.action === 'APPROVED'
                ? 'border-success/50'
                : ['REJECTED', 'DISPUTED'].includes(event.action)
                  ? 'border-error/50'
                  : ['SUBMITTED', 'CLIENT_SUBMITTED'].includes(event.action)
                    ? 'border-primary/50'
                    : 'border-warning/50'
            "
          >
            <p class="whitespace-pre-line break-words leading-relaxed">{{ event.comment }}</p>
          </blockquote>
        </div>
      </li>
    </ol>
  </section>
</template>
