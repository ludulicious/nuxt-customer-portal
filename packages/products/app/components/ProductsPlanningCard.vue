<script setup lang="ts">
import type { Product } from '../../shared/types'
import { defaultPlanning } from '../../shared/planning'

const props = defineProps<{ product: Product; editing: boolean }>()
const emit = defineEmits<{ edit: [] }>()
const { t } = useI18n()
const members = ref<Array<{ userId: string; name: string; enabled: boolean }>>([])
const installed = ref(false)
const planning = computed(() => props.product.planning || defaultPlanning())
const assigned = computed(() =>
  members.value.filter((member) => planning.value.providerUserIds.includes(member.userId))
)
onMounted(async () => {
  try {
    members.value = await $fetch('/api/planning/admin/providers')
    installed.value = true
  } catch {
    /* Planning is an optional layer. */
  }
})
</script>

<template>
  <UCard v-if="installed">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t('products.planningTitle') }}</h2>
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          :aria-label="t('products.editPlanning')"
          :aria-expanded="editing"
          @click="emit('edit')"
        />
      </div>
    </template>
    <slot v-if="editing" name="editor" />
    <dl v-else class="space-y-3 text-sm">
      <div>
        <dt class="text-muted">{{ t('products.plannable') }}</dt>
        <dd>{{ t(planning.enabled ? 'products.yes' : 'products.no') }}</dd>
      </div>
      <template v-if="planning.enabled">
        <div>
          <dt class="text-muted">{{ t('products.durationMinutes') }}</dt>
          <dd>{{ planning.durationMinutes }}</dd>
        </div>
        <div>
          <dt class="text-muted">{{ t('products.planningProviders') }}</dt>
          <dd v-for="member in assigned" :key="member.userId">
            {{ member.enabled ? member.name : t('products.planningMemberDisabled', { name: member.name }) }}
          </dd>
        </div>
        <div>
          <dt class="text-muted">{{ t('products.meetingProvider') }}</dt>
          <dd>{{ planning.meetingProvider === 'zoom' ? 'Zoom' : t('products.noMeeting') }}</dd>
        </div>
      </template>
    </dl>
  </UCard>
</template>
