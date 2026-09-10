<script setup lang="ts">
const model = defineModel<string | null>({ default: null })
const props = withDefaults(defineProps<{ inheritedTimezone?: string; allowInherit?: boolean }>(), {
  allowInherit: true
})
const { t } = useI18n()
const value = computed({
  get: () => model.value ?? '__inherit__',
  set: (value: string) => {
    model.value = value === '__inherit__' ? null : value
  }
})
const options = computed(() => [
  ...(props.allowInherit !== false
    ? [
        {
          label: t('timezones.inherit', { timezone: props.inheritedTimezone || 'Europe/Amsterdam' }),
          value: '__inherit__'
        }
      ]
    : []),
  ...[...new Set(['UTC', ...Intl.supportedValuesOf('timeZone'), ...(model.value ? [model.value] : [])])]
    .sort()
    .map((zone) => ({ label: zone, value: zone }))
])
</script>

<template><USelectMenu v-model="value" :items="options" value-key="value" class="w-full" /></template>
