<script setup lang="ts">
const { t } = useI18n();
const api = useInvoices();
const toast = useToast();
const { data: suppliers, refresh: refreshSuppliers } = await useAsyncData(
  'invoice-viewer-suppliers',
  api.clientInvoiceSuppliers,
);
const supplier = computed(() => suppliers.value?.[0] ?? null);
const { data: viewers, refresh } = await useAsyncData(
  'invoice-viewers',
  async () =>
    supplier.value ? api.clientInvoiceViewers(supplier.value.id) : [],
);
const fixedViewers = computed(
  () => viewers.value?.filter((person) => person.fixedAccess) ?? [],
);
const configurableViewers = computed(
  () => viewers.value?.filter((person) => !person.fixedAccess) ?? [],
);
const viewerCount = computed(
  () => viewers.value?.filter((person) => person.assigned).length ?? 0,
);
const toggle = async (userId: string, assigned: boolean) => {
  if (!supplier.value) return;
  try {
    await api.setClientInvoiceViewer(supplier.value.id, userId, assigned);
    await Promise.all([refresh(), refreshSuppliers()]);
    window.dispatchEvent(new CustomEvent('invoices:capabilities-refresh'))
  } catch {
    toast.add({
      title: t("features.invoices.messages.saveError"),
      color: "error",
    });
  }
};
useSeoMeta({
  title: () => t("features.invoices.clientInvoices.viewersTitle"),
});
</script>

<template>
  <InvoicesPageShell width="narrow" class="h-full overflow-y-auto">
    <header class="border-b border-default pb-5">
      <h1 class="text-2xl font-semibold">
        {{ t("features.invoices.clientInvoices.viewersTitle") }}
      </h1>
      <p class="mt-1 text-sm text-muted">
        {{ t("features.invoices.clientInvoices.viewersSubtitle") }}
      </p>
    </header>
    <UAlert
      v-if="!supplier"
      class="mt-6"
      icon="i-lucide-receipt-text"
      :title="t('features.invoices.clientInvoices.accessUnavailable')"
      variant="outline"
    />
    <section v-else class="my-6 rounded-lg border border-default bg-default">
      <header class="border-b border-default p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">
              {{ t("features.invoices.clientInvoices.chooseViewers") }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ t("features.invoices.clientInvoices.viewerHelp") }}
            </p>
          </div>
          <UBadge color="neutral" variant="subtle">{{
            t("features.invoices.clientInvoices.viewerCount", viewerCount)
          }}</UBadge>
        </div>
      </header>
      <div v-if="fixedViewers.length" class="border-b border-default">
        <h3
          class="bg-elevated/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted"
        >
          {{ t("features.invoices.clientInvoices.alwaysAccess") }}
        </h3>
        <div class="divide-y divide-default">
          <div
            v-for="person in fixedViewers"
            :key="person.id"
            class="flex items-center justify-between gap-3 p-4"
          >
            <span class="min-w-0"
              ><strong class="block text-sm">{{ person.name }}</strong
              ><span class="block truncate text-xs text-muted">{{
                person.email
              }}</span></span
            >
            <div class="flex items-center gap-2">
              <UBadge color="neutral" variant="soft">{{
                t(`features.invoices.roles.${person.role}`)
              }}</UBadge>
              <UBadge color="success" variant="soft">{{
                t("features.invoices.clientInvoices.hasAccess")
              }}</UBadge>
            </div>
          </div>
        </div>
      </div>
      <div v-if="configurableViewers.length">
        <h3
          class="bg-elevated/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted"
        >
          {{ t("features.invoices.clientInvoices.additionalAccess") }}
        </h3>
        <div class="divide-y divide-default">
          <label
            v-for="person in configurableViewers"
            :key="person.id"
            class="flex items-center gap-3 p-4 hover:bg-elevated/40"
            ><USwitch
              :model-value="person.assigned"
              @update:model-value="toggle(person.id, $event)"
            /><span class="min-w-0"
              ><strong class="block text-sm">{{ person.name }}</strong
              ><span class="block truncate text-xs text-muted">{{
                person.email
              }}</span></span
            ></label
          >
        </div>
      </div>
      <p
        v-if="!fixedViewers.length && !configurableViewers.length"
        class="p-5 text-sm text-muted"
      >
        {{ t("features.invoices.clientInvoices.noEligibleViewers") }}
      </p>
      <footer class="border-t border-default p-4 text-xs text-muted">
        {{ t("features.invoices.clientInvoices.adminAccessHelp") }}
      </footer>
    </section>
  </InvoicesPageShell>
</template>
