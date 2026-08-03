<script setup lang="ts">
/* eslint-disable @stylistic/max-statements-per-line, vue/multiline-html-element-content-newline */
import { z } from 'zod'
import type { DeepReadonly } from 'vue'
import type { TimesheetsAdminBootstrap } from '#layers/timesheets/app/composables/useTimesheets'
import type { ClientDto, OrganizationContactDto } from '#layers/timesheets/shared/types/timesheet'

const props = defineProps<{ data: TimesheetsAdminBootstrap, refresh: () => Promise<unknown> }>()
const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const api = useTimesheets()
const busy = ref(false)
const formOpen = ref(false)
const organizationId = ref('')
const editingClientId = ref('')
const editingContactId = ref('')
const contactFormOpen = ref(false)
const contactDeleteOpen = ref(false)
const contactDeletion = ref<{ organizationId: string, contact: OrganizationContactDto } | null>(null)
const listing = useTimesheetsAdminList<ClientDto>({ endpoint: '/api/timesheets/admin/clients', filterKeys: ['configured'], defaultSort: 'name' })
const clients = listing.items
const clientFilters = computed(() => [{ key: 'configured', placeholder: t('features.timesheets.admin.list.configurationFilter'), items: [{ label: t('features.timesheets.admin.list.allConfigurations'), value: undefined }, { label: t('features.timesheets.admin.list.configured'), value: 'configured' }, { label: t('features.timesheets.admin.list.incomplete'), value: 'incomplete' }] }])
const sortOptions = computed(() => [{ label: t('features.timesheets.admin.list.sortName'), value: 'name' }])
const profile = reactive({ address: '', registrationNumber: '', vatNumber: '', invoiceEmail: '', preferredLocale: 'nl' as 'nl' | 'en' })
const profileSchema = computed(() => z.object({
  address: z.string().trim().min(1, t('features.timesheets.admin.addressRequired')),
  registrationNumber: z.string(),
  vatNumber: z.string(),
  invoiceEmail: z.string()
    .trim()
    .min(1, t('features.timesheets.admin.invoiceEmailRequired'))
    .email(t('features.timesheets.admin.invoiceEmailInvalid')),
  preferredLocale: z.enum(['nl', 'en'])
}))
const contact = reactive({ name: '', email: '', phone: '', jobTitle: '', userId: null as string | null })
type ContactFormInstance = {
  setErrors: (errors: Array<{ name: string, message: string }>) => void
}
const contactForm = ref<ContactFormInstance | ContactFormInstance[] | null>(null)
const activeContactForm = () => Array.isArray(contactForm.value) ? contactForm.value[0] : contactForm.value
const editedClient = computed(() => clients.value.find(client => client.organizationId === editingClientId.value))
const contactSchema = computed(() => z.object({
  name: z.string().trim().min(1, t('features.timesheets.validation.required')).max(200),
  email: z.string().trim().min(1, t('features.timesheets.validation.required')).email(t('features.timesheets.validation.validEmail')).max(320),
  phone: z.string().trim().max(80),
  jobTitle: z.string().trim().max(160),
  userId: z.string().nullable()
}).superRefine((value, context) => {
  const duplicate = editedClient.value?.contacts.some(item =>
    item.id !== editingContactId.value && item.email.trim().toLowerCase() === value.email.trim().toLowerCase()
  )
  if (duplicate) context.addIssue({
    code: 'custom',
    path: ['email'],
    message: t('features.timesheets.validation.contactEmailUnique')
  })
}))
const run = async (operation: () => Promise<unknown>, successTitle?: string) => {
  busy.value = true
  try { await operation(); await props.refresh(); await listing.refresh(); if (successTitle) toast.add({ title: successTitle, color: 'success' }) } catch (error) { toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' }) } finally { busy.value = false }
}
const resetContact = () => {
  editingContactId.value = ''
  Object.assign(contact, { name: '', email: '', phone: '', jobTitle: '', userId: null })
  activeContactForm()?.setErrors([])
}
const closeContactForm = () => {
  resetContact()
  contactFormOpen.value = false
}
const closeClientEditor = async () => {
  editingClientId.value = ''
  closeContactForm()
  if (typeof route.query.edit !== 'string') return
  const query = { ...route.query }
  delete query.edit
  await navigateTo({ path: route.path, query }, { replace: true })
}
onKeyStroke('Escape', () => {
  if (editingClientId.value) void closeClientEditor()
})
const openNewContact = () => {
  resetContact()
  contactFormOpen.value = true
}
const positionClientEditor = async (organizationId: string) => {
  if (!import.meta.client) return
  await nextTick()
  const editor = document.getElementById(`client-${organizationId}`)
  if (!editor) return
  const headerHeight = document.querySelector('header')?.getBoundingClientRect().height || 72
  const availableHeight = window.innerHeight - headerHeight - 32
  editor.scrollIntoView({ behavior: 'smooth', block: editor.offsetHeight <= availableHeight ? 'center' : 'start' })
  const firstField = editor.querySelector<HTMLElement>('textarea:not([disabled]), input:not([disabled]), select:not([disabled]), button[role="combobox"]:not([disabled])')
  firstField?.focus({ preventScroll: true })
}
const openClient = async (client: DeepReadonly<ClientDto>) => {
  const opening = editingClientId.value !== client.organizationId
  editingClientId.value = opening ? client.organizationId : ''
  Object.assign(profile, { address: client.address, registrationNumber: client.registrationNumber ?? '', vatNumber: client.vatNumber ?? '', invoiceEmail: client.invoiceEmail ?? '', preferredLocale: client.preferredLocale === 'en' ? 'en' : 'nl' })
  resetContact()
  contactFormOpen.value = false
  if (opening) await positionClientEditor(client.organizationId)
}
const openRequestedClient = async () => {
  const requestedId = typeof route.query.edit === 'string' ? route.query.edit : ''
  const client = clients.value.find(item => item.organizationId === requestedId)
  if (!client || editingClientId.value === requestedId) return
  editingClientId.value = client.organizationId
  Object.assign(profile, { address: client.address, registrationNumber: client.registrationNumber ?? '', vatNumber: client.vatNumber ?? '', invoiceEmail: client.invoiceEmail ?? '', preferredLocale: client.preferredLocale === 'en' ? 'en' : 'nl' })
  resetContact()
  contactFormOpen.value = false
  await positionClientEditor(client.organizationId)
}
watch([() => route.query.edit, clients], openRequestedClient, { immediate: true })
const openContact = (item?: OrganizationContactDto) => {
  if (!item) return resetContact()
  activeContactForm()?.setErrors([])
  editingContactId.value = item.id
  Object.assign(contact, { name: item.name, email: item.email, phone: item.phone ?? '', jobTitle: item.jobTitle ?? '', userId: item.userId })
  contactFormOpen.value = true
}
const requestContactDeletion = (organizationId: string, item: OrganizationContactDto) => {
  contactDeletion.value = { organizationId, contact: item }
  contactDeleteOpen.value = true
}
const confirmContactDeletion = async () => {
  const target = contactDeletion.value
  if (!target) return
  await run(async () => {
    await api.deleteContact(target.organizationId, target.contact.id)
    if (editingContactId.value === target.contact.id) closeContactForm()
    contactDeletion.value = null
  })
}
const saveProfile = () => run(() => api.updateOrganizationProfile(editingClientId.value, {
  address: profile.address, registrationNumber: profile.registrationNumber || null, vatNumber: profile.vatNumber || null, invoiceEmail: profile.invoiceEmail || null, preferredLocale: profile.preferredLocale
}), t('features.timesheets.messages.clientInvoiceDetailsSaved'))
const saveContact = async () => {
  busy.value = true
  try {
    const input = { ...contact, email: contact.email.trim().toLowerCase(), phone: contact.phone || null, jobTitle: contact.jobTitle || null }
    if (editingContactId.value) await api.updateContact(editingClientId.value, editingContactId.value, input)
    else await api.createContact(editingClientId.value, input)
    closeContactForm()
    await props.refresh()
    await listing.refresh()
  } catch (error) {
    const fetchError = error as { status?: number, statusCode?: number }
    if (fetchError.status === 409 || fetchError.statusCode === 409) {
      activeContactForm()?.setErrors([{ name: 'email', message: t('features.timesheets.validation.contactEmailUnique') }])
    } else {
      toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' })
    }
  } finally {
    busy.value = false
  }
}
const saveClient = () => run(async () => { await api.createClient({ organizationId: organizationId.value }); organizationId.value = ''; formOpen.value = false })
const removeClient = (client: DeepReadonly<ClientDto>) => run(() => api.deleteClient(client.id, client.name))
defineExpose({
  canCreate: computed(() => Boolean(props.data.availableClientOrganizations.length)),
  openCreate: () => { formOpen.value = true },
  refreshList: () => listing.refresh(),
  showCreate: computed(() => Boolean(clients.value.length) && !formOpen.value)
})
await listing.load()
</script>

<template>
  <section class="flex h-full min-h-0 flex-col gap-4">
    <TimesheetsAdminListToolbar v-model:search="listing.search.value" :filters="clientFilters" :filter-values="listing.filters" :sort-options="sortOptions" :sort-by="listing.sortBy.value" :sort-dir="listing.sortDir.value" @filter="listing.setFilter" @sort="listing.sortBy.value = $event" @toggle-direction="listing.toggleSortDir" />
    <TimesheetsAdminPaginatedList class="min-h-0 flex-1" :pagination="listing.pagination.value" :pending="listing.pending.value" :loading-next="listing.loadingNextPage.value" :loading-previous="listing.loadingPreviousPage.value" :has-next="listing.hasNextPage.value" :has-previous="listing.hasPreviousPage.value" @next="listing.loadNext" @previous="listing.loadPrevious" @page="listing.goToPage">
      <TimesheetsAdminEmptyState v-if="!clients.length && !formOpen && !listing.pending.value" icon="i-lucide-building-2" :title="t('features.timesheets.admin.noClientsTitle')" :description="t('features.timesheets.admin.noClientsDescription')" :action-label="t('features.timesheets.admin.createFirstClient')" :action-disabled="!data.availableClientOrganizations.length" @action="formOpen = true" />
      <div class="grid gap-3">
      <TimesheetsClientForm v-if="formOpen" v-model="organizationId" :data="data" :busy="busy" :show-cancel="true" @submit="saveClient" @cancel="formOpen = false" />
    <template v-for="client in clients" :key="client.id">
      <UCard
        role="button"
        tabindex="0"
        class="cursor-pointer transition-colors hover:ring-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="editingClientId === client.organizationId ? 'ring-2 ring-primary' : ''"
        @click="openClient(client)"
        @keydown.enter="openClient(client)"
        @keydown.space.prevent="openClient(client)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3"><UAvatar :src="client.logo ?? undefined" :alt="client.name" /><div class="min-w-0"><p class="truncate font-medium">{{ client.name }}</p><p class="truncate text-sm text-muted">{{ client.address || t('features.timesheets.admin.missingInvoiceAddress') }}</p></div></div>
          <div class="flex shrink-0 gap-1"><UButton type="button" size="xs" variant="ghost" icon="i-lucide-pencil" :aria-label="t('features.timesheets.admin.editClient')" @click.stop="openClient(client)" @keydown.stop /><UButton type="button" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('features.timesheets.admin.removeClient')" @click.stop="removeClient(client)" @keydown.stop /></div>
        </div>
      </UCard>
      <UCard v-if="editingClientId === client.organizationId" :id="`client-${client.organizationId}`" class="client-editor">
        <template #header><div class="flex items-center justify-between gap-3"><h2 class="font-semibold">{{ t('features.timesheets.admin.clientInvoiceDetails', { name: client.name }) }}</h2><UButton type="button" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="t('features.timesheets.admin.close')" @click="closeClientEditor" /></div></template>
        <UForm :state="profile" :schema="profileSchema" class="space-y-3" @submit="saveProfile"><UFormField name="address" :label="t('features.timesheets.admin.address')" required><UTextarea v-model="profile.address" class="w-full" /></UFormField><div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><UFormField name="registrationNumber" :label="t('features.timesheets.admin.registration')"><UInput v-model="profile.registrationNumber" class="w-full" /></UFormField><UFormField name="vatNumber" :label="t('features.timesheets.admin.vatNumber')"><UInput v-model="profile.vatNumber" class="w-full" /></UFormField><UFormField name="invoiceEmail" :label="t('features.timesheets.admin.invoiceEmail')" required><UInput v-model="profile.invoiceEmail" type="email" class="w-full" /></UFormField><UFormField name="preferredLocale" :label="t('features.timesheets.admin.preferredLanguage')"><USelect v-model="profile.preferredLocale" :items="[{ label: t('features.timesheets.languages.nl'), value: 'nl' }, { label: t('features.timesheets.languages.en'), value: 'en' }]" value-key="value" class="w-full" /></UFormField></div><div class="flex justify-end gap-2"><UButton type="button" color="neutral" variant="outline" @click="closeClientEditor">{{ t('features.timesheets.cancel') }}</UButton><UButton type="submit" icon="i-lucide-save" :loading="busy">{{ t('features.timesheets.save') }}</UButton></div></UForm>
        <div class="mt-6 border-t border-default pt-5"><div class="flex items-center justify-between gap-3"><h3 class="font-medium">{{ t('features.timesheets.admin.contactPersons') }}</h3><UButton v-if="client.contacts.length && !contactFormOpen" type="button" size="sm" variant="outline" icon="i-lucide-plus" @click="openNewContact">{{ t('features.timesheets.admin.addContact') }}</UButton></div><TimesheetsAdminEmptyState v-if="!client.contacts.length && !contactFormOpen" class="mt-3" icon="i-lucide-contact-round" :title="t('features.timesheets.admin.noContactsTitle')" :description="t('features.timesheets.admin.noContactsDescription')" :action-label="t('features.timesheets.admin.addContact')" @action="openNewContact" /><div v-else class="mt-3 grid gap-2"><div v-for="item in client.contacts" :key="item.id" class="flex items-center justify-between rounded-md border border-default p-3"><div><p class="text-sm font-medium">{{ item.name }} · {{ item.email }}</p><p v-if="item.jobTitle" class="text-xs text-muted">{{ item.jobTitle }}</p></div><div class="flex gap-1"><UButton size="xs" variant="ghost" icon="i-lucide-pencil" :aria-label="t('features.timesheets.admin.editContact')" @click="openContact(item)" /><UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('features.timesheets.admin.deleteContact')" @click="requestContactDeletion(client.organizationId, item)" /></div></div></div>
          <UForm v-if="contactFormOpen" ref="contactForm" :state="contact" :schema="contactSchema" class="mt-4 grid gap-3 md:grid-cols-2" @submit="saveContact"><UFormField name="name" :label="t('features.timesheets.admin.name')" required><UInput v-model="contact.name" class="w-full" /></UFormField><UFormField name="email" :label="t('features.timesheets.admin.email')" required><UInput v-model="contact.email" type="email" class="w-full" /></UFormField><UFormField name="phone" :label="t('features.timesheets.admin.phone')"><UInput v-model="contact.phone" class="w-full" /></UFormField><UFormField name="jobTitle" :label="t('features.timesheets.admin.jobTitle')"><UInput v-model="contact.jobTitle" class="w-full" /></UFormField><div class="contact-form-actions flex justify-end gap-2"><UButton v-if="client.contacts.length || editingContactId" type="button" color="neutral" variant="outline" @click="closeContactForm">{{ t('features.timesheets.cancel') }}</UButton><UButton type="submit" :loading="busy">{{ t(editingContactId ? 'features.timesheets.admin.updateContact' : 'features.timesheets.admin.addContact') }}</UButton></div></UForm>
        </div>
      </UCard>
    </template>
      </div>
    </TimesheetsAdminPaginatedList>
    <ConfirmationModal
      v-model:open="contactDeleteOpen"
      :title="t('features.timesheets.admin.deleteContactTitle')"
      :message="t('features.timesheets.admin.deleteContactDescription', { name: contactDeletion?.contact.name, email: contactDeletion?.contact.email })"
      :confirm-text="t('features.timesheets.admin.deleteContact')"
      :cancel-text="t('features.timesheets.cancel')"
      confirm-color="error"
      @confirm="confirmContactDeletion"
      @cancel="contactDeletion = null"
    />
  </section>
</template>

<style scoped>
.contact-form-actions { grid-column: 1 / -1; }
.client-editor { scroll-margin-top: calc(var(--ui-header-height) + 1rem); }
@media (min-width: 48rem) { .contact-form-actions { grid-column: 2; } }
</style>
