<!-- Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 -->
<script setup lang="ts">
const { t } = useI18n()
const api = useTimesheets()
const toast = useToast()
const { data: suppliers, refresh: refreshSuppliers } = await useAsyncData(
  'timesheet-reviewer-suppliers',
  api.clientReviewerSuppliers
)
const supplier = computed(() => suppliers.value?.[0] ?? null)
const { data: reviewers, refresh } = await useAsyncData('timesheet-approval-reviewers', async () =>
  supplier.value ? api.clientReviewers(supplier.value.id) : []
)
const fixedReviewers = computed(() => reviewers.value?.filter((person) => person.fixedAccess) ?? [])
const configurableReviewers = computed(() => reviewers.value?.filter((person) => !person.fixedAccess) ?? [])
const reviewerCount = computed(() => reviewers.value?.filter((person) => person.assigned).length ?? 0)
const toggle = async (userId: string, assigned: boolean) => {
  if (!supplier.value) {
    return
  }
  try {
    await api.setClientReviewer(supplier.value.id, userId, assigned)
    await Promise.all([refresh(), refreshSuppliers()])
    window.dispatchEvent(new CustomEvent('timesheets:capabilities-refresh'))
  } catch {
    toast.add({
      title: t('features.timesheets.messages.saveError'),
      color: 'error'
    })
  }
}
useSeoMeta({ title: () => t('features.timesheets.approvals.reviewersTitle') })
</script>

<template>
  <TimesheetsPageShell width="narrow" class="h-full overflow-y-auto">
    <header class="border-b border-default pb-5">
      <h1 class="text-2xl font-semibold">
        {{ t('features.timesheets.approvals.reviewersTitle') }}
      </h1>
      <p class="mt-1 text-sm text-muted">
        {{ t('features.timesheets.approvals.reviewersSubtitle') }}
      </p>
    </header>
    <UAlert
      v-if="!supplier"
      class="mt-6"
      icon="i-lucide-users-round"
      :title="t('features.timesheets.approvals.approvalUnavailable')"
      variant="outline"
    />
    <section v-else class="my-6 rounded-lg border border-default bg-default">
      <header class="border-b border-default p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">
              {{ t('features.timesheets.approvals.chooseReviewers') }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ t('features.timesheets.clientPortal.reviewerHelp') }}
            </p>
          </div>
          <UBadge color="neutral" variant="subtle">
            {{ t('features.timesheets.approvals.reviewerCount', reviewerCount) }}
          </UBadge>
        </div>
      </header>
      <div v-if="fixedReviewers.length" class="border-b border-default">
        <h3 class="bg-elevated/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {{ t('features.timesheets.approvals.alwaysAccess') }}
        </h3>
        <div class="divide-y divide-default">
          <div v-for="person in fixedReviewers" :key="person.id" class="flex items-center justify-between gap-3 p-4">
            <span class="min-w-0"
              ><strong class="block text-sm">{{ person.name }}</strong
              ><span class="block truncate text-xs text-muted">{{ person.email }}</span></span
            >
            <div class="flex items-center gap-2">
              <UBadge color="neutral" variant="soft">
                {{ t(`features.timesheets.roles.${person.role}`) }}
              </UBadge>
              <UBadge color="success" variant="soft">
                {{ t('features.timesheets.approvals.hasAccess') }}
              </UBadge>
            </div>
          </div>
        </div>
      </div>
      <div v-if="configurableReviewers.length">
        <h3 class="bg-elevated/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {{ t('features.timesheets.approvals.additionalAccess') }}
        </h3>
        <div class="divide-y divide-default">
          <label
            v-for="person in configurableReviewers"
            :key="person.id"
            class="flex items-center gap-3 p-4 hover:bg-elevated/40"
            ><USwitch :model-value="person.assigned" @update:model-value="toggle(person.id, $event)" /><span
              class="min-w-0"
              ><strong class="block text-sm">{{ person.name }}</strong
              ><span class="block truncate text-xs text-muted">{{ person.email }}</span></span
            ></label
          >
        </div>
      </div>
      <p v-if="!fixedReviewers.length && !configurableReviewers.length" class="p-5 text-sm text-muted">
        {{ t('features.timesheets.approvals.noEligibleReviewers') }}
      </p>
      <footer class="border-t border-default p-4 text-xs text-muted">
        {{ t('features.timesheets.clientPortal.saveReviewers') }}
      </footer>
    </section>
  </TimesheetsPageShell>
</template>
