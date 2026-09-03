<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { z } from 'zod'
import type { ApiError, Organization } from '@nuxt-customer-portal/core/shared/types/index'

const props = defineProps<{
  organization: Organization
}>()

const emit = defineEmits<{
  canceled: []
  updated: [organization: Organization]
}>()

const { t } = useI18n()
const { updateAdminOrganization } = useOrganization()
const form = useTemplateRef('form')
const saving = ref(false)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const selectedFile = ref<File | null>(null)
const avatarInput = useTemplateRef<HTMLInputElement>('avatarInput')
const metadata = (() => {
  try {
    return props.organization.metadata ? (JSON.parse(props.organization.metadata) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
})()
const state = reactive({
  name: props.organization.name,
  slug: props.organization.slug,
  officialCompanyName:
    typeof metadata.officialCompanyName === 'string' ? metadata.officialCompanyName : props.organization.name,
  logo: props.organization.logo ?? '',
  avatarLogo: typeof metadata.avatarLogo === 'string' ? metadata.avatarLogo : ''
})

const normalizeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const schema = computed(() =>
  z.object({
    name: z.string().trim().min(1, t('organization.settings.validation.nameRequired')),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t('organization.settings.validation.slugInvalid')),
    officialCompanyName: z
      .string()
      .trim()
      .min(1, t('organization.settings.validation.officialCompanyNameRequired'))
      .max(200),
    logo: z
      .string()
      .max(2_800_000, t('organization.settings.validation.logoTooLarge'))
      .refine(
        (value) =>
          !value || /^data:image\/(png|jpeg|gif|webp);base64,/.test(value) || z.string().url().safeParse(value).success,
        t('organization.settings.validation.logoInvalid')
      ),
    avatarLogo: z
      .string()
      .max(2_800_000, t('organization.settings.validation.logoTooLarge'))
      .refine(
        (value) =>
          !value || /^data:image\/(png|jpeg|gif|webp);base64,/.test(value) || z.string().url().safeParse(value).success,
        t('organization.settings.validation.logoInvalid')
      )
  })
)

watch(
  () => state.slug,
  (slug) => {
    const normalized = normalizeSlug(slug)
    if (slug !== normalized) {
      state.slug = normalized
    }
  }
)

async function submit(event: FormSubmitEvent<z.output<typeof schema.value>>) {
  saving.value = true
  form.value?.clear()
  try {
    const updated = await updateAdminOrganization(props.organization.id, event.data)
    emit('updated', updated)
  } catch (error) {
    const apiError = error as ApiError
    if (apiError.statusCode === 409) {
      form.value?.setErrors([{ name: 'slug', message: t('organization.settings.errors.slugTaken') }])
    } else {
      form.value?.setErrors([
        { name: 'name', message: apiError.message || t('organization.settings.errors.updateFailed') }
      ])
    }
  } finally {
    saving.value = false
  }
}

function chooseLogo() {
  fileInput.value?.click()
}

function removeLogo() {
  state.logo = ''
  selectedFile.value = null
}

function selectLogo(event: Event, field: 'logo' | 'avatarLogo' = 'logo') {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    return
  }
  form.value?.clear(field)
  if (file.size > 2 * 1024 * 1024) {
    form.value?.setErrors([{ name: field, message: t('organization.settings.validation.logoTooLarge') }])
    return
  }
  selectedFile.value = file
  const reader = new FileReader()
  reader.onload = () => {
    state[field] = String(reader.result ?? '')
  }
  reader.readAsDataURL(file)
}
</script>

<template>
  <UForm ref="form" novalidate :state="state" :schema="schema" class="space-y-4" @submit="submit">
    <UFormField name="name" :label="t('organization.settings.nameLabel')" required>
      <UInput v-model="state.name" :placeholder="t('organization.settings.namePlaceholder')" class="w-full" />
    </UFormField>

    <UFormField
      name="slug"
      :label="t('organization.settings.slugLabel')"
      :hint="t('organization.settings.slugHint')"
      required
    >
      <UInput v-model="state.slug" :placeholder="t('organization.settings.slugPlaceholder')" class="w-full" />
    </UFormField>

    <UFormField
      name="officialCompanyName"
      :label="t('organization.settings.officialCompanyNameLabel')"
      :hint="t('organization.settings.officialCompanyNameHint')"
      required
    >
      <UInput
        v-model="state.officialCompanyName"
        :placeholder="t('organization.settings.officialCompanyNamePlaceholder')"
        class="w-full"
      />
    </UFormField>

    <UFormField
      name="logo"
      :label="t('organization.settings.logoLabel')"
      :hint="t('organization.settings.invoiceLogoHint')"
    >
      <div class="flex flex-wrap items-center gap-3">
        <div
          class="flex h-20 w-32 items-center justify-center overflow-hidden rounded-md border border-default bg-muted/30"
        >
          <img
            v-if="state.logo"
            :src="state.logo"
            :alt="state.officialCompanyName"
            class="h-full w-full object-contain p-2"
          />
          <UIcon v-else name="i-lucide-building-2" class="size-7 text-muted" />
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton type="button" color="neutral" variant="outline" icon="i-lucide-upload" @click="chooseLogo">
            {{ t('organization.settings.logoChoose') }}
          </UButton>
          <UButton
            v-if="state.logo"
            type="button"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            @click="removeLogo"
          >
            {{ t('organization.settings.logoRemove') }}
          </UButton>
        </div>
        <input
          ref="fileInput"
          type="file"
          class="hidden"
          accept="image/png,image/jpeg,image/gif,image/webp"
          @change="selectLogo($event)"
        />
      </div>
    </UFormField>

    <UFormField
      name="avatarLogo"
      :label="t('organization.settings.avatarLogoLabel')"
      :hint="t('organization.settings.avatarLogoHint')"
    >
      <div class="flex flex-wrap items-center gap-3">
        <UAvatar :src="state.avatarLogo || undefined" :alt="state.name" size="3xl" />
        <UButton type="button" color="neutral" variant="outline" icon="i-lucide-upload" @click="avatarInput?.click()">
          {{ t('organization.settings.logoChoose') }}
        </UButton>
        <UButton
          v-if="state.avatarLogo"
          type="button"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          @click="state.avatarLogo = ''"
        >
          {{ t('organization.settings.logoRemove') }}
        </UButton>
        <input
          ref="avatarInput"
          type="file"
          class="hidden"
          accept="image/png,image/jpeg,image/gif,image/webp"
          @change="selectLogo($event, 'avatarLogo')"
        />
      </div>
    </UFormField>

    <div class="flex justify-end gap-2 pt-2">
      <UButton type="button" color="neutral" variant="outline" :disabled="saving" @click="emit('canceled')">
        {{ t('common.cancel') }}
      </UButton>
      <UButton
        type="submit"
        :loading="saving"
        :disabled="saving || !state.name.trim() || !state.slug.trim() || !state.officialCompanyName.trim()"
      >
        {{ t('common.save') }}
      </UButton>
    </div>
  </UForm>
</template>
