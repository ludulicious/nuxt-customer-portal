<script setup lang="ts" generic="Line extends InvoiceLineEdit">
import { currencyScale } from '@nuxt-customer-portal/invoices/shared/money'
import { invoiceLineAmount } from '@nuxt-customer-portal/invoices/shared/invoice-copy'
import {
  hasSameInvoiceLineAmounts,
  invoiceLineErrorIndex,
  moveInvoiceLine,
  type InvoiceLineEdit
} from '@nuxt-customer-portal/invoices/shared/invoice-line-edit'
import type { InvoiceLineDto } from '@nuxt-customer-portal/invoices/shared/types/invoice'
import { useDragOrder } from '@nuxt-customer-portal/core/app/composables/useDragOrder'

const props = withDefaults(
  defineProps<{
    currency: string
    defaultVatRateBasisPoints?: number
    credit?: boolean
    originalLines?: InvoiceLineDto[]
    createLine?: () => Line
    canRemove?: (line: Line) => boolean
  }>(),
  { credit: false, originalLines: () => [], defaultVatRateBasisPoints: 2100 }
)
const lines = defineModel<Line[]>({ required: true })
const lineEditor = ref<HTMLElement | null>(null)
const activeLine = shallowRef<Line | null>(lines.value.find((line) => !line.description.trim()) ?? null)
const isEditingLine = (line: Line): boolean => activeLine.value === line
const listContainer = ref<HTMLElement | null>(null)
const orderAnnouncement = ref('')
const helpId = useId()
const lineKeys = new WeakMap<Line, number>()
let nextLineKey = 0
const lineKey = (line: Line) => {
  if (!lineKeys.has(line)) {
    lineKeys.set(line, nextLineKey++)
  }
  return lineKeys.get(line)!
}
const { draggedId, orderedIds, start, over, finish, cancel } = useDragOrder({
  ids: computed(() => lines.value.map((line) => String(lineKey(line)))),
  disabled: computed(() => lines.value.length <= 1),
  container: listContainer,
  selector: '[data-invoice-line]'
})
const orderedLines = computed(() => {
  const byId = new Map(lines.value.map((line) => [String(lineKey(line)), line]))
  return orderedIds.value.map((id) => byId.get(id)!)
})
const { t, locale } = useI18n()
const scale = computed(() => currencyScale(props.currency))
const money = (amount: number) =>
  new Intl.NumberFormat(locale.value, { style: 'currency', currency: props.currency }).format(amount / scale.value)
const quantity = (line: Line) =>
  new Intl.NumberFormat(locale.value, { maximumFractionDigits: 3 }).format(line.quantityMilli / 1000)
const percentage = (line: Line) =>
  new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 2 }).format(
    line.vatRateBasisPoints / 10_000
  )
const amount = (line: Line) => invoiceLineAmount(line.quantityMilli, line.unitPriceMinor)
const subtotal = computed(() => lines.value.reduce((sum, line) => sum + amount(line), 0))
const vat = computed(() =>
  lines.value.reduce((sum, line) => {
    const previous = props.originalLines.find((original) => original.id === line.id)
    const exactTax = hasSameInvoiceLineAmounts(line, previous) ? previous?.exactTaxMinor : null
    return sum + (exactTax ?? Math.round((amount(line) * line.vatRateBasisPoints) / 10_000))
  }, 0)
)
const newLine = () =>
  props.createLine?.() ??
  ({
    description: '',
    quantityMilli: 1000,
    unit: 'item',
    unitPriceMinor: 0,
    vatRateBasisPoints: props.defaultVatRateBasisPoints
  } as Line)
const editLine = async (line: Line) => {
  activeLine.value = line
  await nextTick()
  lineEditor.value?.querySelector('textarea')?.focus()
}
const closeEditor = () => {
  activeLine.value = null
}
const addLine = async () => {
  const line = newLine()
  lines.value.push(line)
  await editLine(lines.value[lines.value.length - 1]!)
}
const moveLine = (line: Line, target: number, event?: KeyboardEvent) => {
  const from = lines.value.indexOf(line)
  const ordered = moveInvoiceLine(lines.value, from, target)
  if (ordered === lines.value) {
    return
  }
  lines.value = ordered
  orderAnnouncement.value = t('features.invoices.admin.lineMoved', { position: target + 1, count: ordered.length })
  const handle = event?.currentTarget as HTMLElement | undefined
  if (handle) {
    void nextTick(() => handle.focus({ preventScroll: true }))
  }
}
const removeLine = (line: Line) => {
  if (lines.value.length <= 1 || props.canRemove?.(line) === false) {
    return
  }
  if (activeLine.value === line) {
    activeLine.value = null
  }
  lines.value = lines.value.filter((item) => item !== line)
}
const startDrag = (event: DragEvent, line: Line) => {
  const target = event.target as HTMLElement
  if (target.closest('input, textarea, select, [contenteditable="true"]')) {
    event.preventDefault()
    return
  }
  start(event, String(lineKey(line)))
}
const dropLine = () => {
  const result = finish()
  if (!result) {
    return
  }
  const byId = new Map(lines.value.map((line) => [String(lineKey(line)), line]))
  const ordered = result.ids.map((id) => byId.get(id)!)
  lines.value = ordered
  orderAnnouncement.value = t('features.invoices.admin.lineMoved', {
    position: result.ids.indexOf(result.id) + 1,
    count: ordered.length
  })
}
const focusError = async (errors: Array<{ name?: string }>) => {
  const index = invoiceLineErrorIndex(errors)
  const line = index === undefined ? undefined : lines.value[index]
  if (line) {
    await editLine(line)
  }
}
watch(lines, (current) => {
  if (activeLine.value && !current.includes(activeLine.value)) {
    activeLine.value = null
  }
})
defineExpose({ focusError })
</script>

<template>
  <section ref="lineEditor" class="space-y-4" :aria-label="t('features.invoices.admin.invoiceDetails')">
    <div>
      <h3 class="font-semibold">{{ t('features.invoices.admin.invoiceDetails') }}</h3>
      <p :id="helpId" class="mt-1 text-sm text-muted">{{ t('features.invoices.admin.lineListHelp') }}</p>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{{ orderAnnouncement }}</p>
    <UFormField name="lines" class="w-full">
      <div ref="listContainer" class="relative" @dragover="over" @drop.prevent.stop="dropLine">
        <TransitionGroup tag="ol" class="w-full space-y-2" move-class="invoice-sort-move">
          <li
            v-for="(line, index) in orderedLines"
            :key="lineKey(line)"
            :data-invoice-line="lineKey(line)"
            :draggable="lines.length > 1"
            class="rounded-lg border bg-default"
            :class="[
              isEditingLine(line) ? 'border-primary' : 'border-default',
              draggedId === String(lineKey(line)) ? 'opacity-40' : ''
            ]"
            @dragstart="startDrag($event, line)"
            @dragend="cancel"
          >
            <div class="flex items-center gap-1 p-2 sm:gap-2 sm:p-3">
              <button
                type="button"
                :disabled="lines.length <= 1"
                class="grid size-9 shrink-0 cursor-grab place-items-center rounded text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
                :aria-label="t('features.invoices.admin.reorderLine', { number: index + 1 })"
                :aria-describedby="helpId"
                aria-keyshortcuts="ArrowUp ArrowDown"
                @keydown.esc.stop.prevent="cancel"
                @keydown.up.prevent="moveLine(line, index - 1, $event)"
                @keydown.down.prevent="moveLine(line, index + 1, $event)"
              >
                <UIcon name="i-lucide-grip-vertical" class="size-5" />
              </button>
              <button
                type="button"
                class="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded px-1 py-2 text-left focus-visible:outline-2 focus-visible:outline-primary"
                :aria-expanded="isEditingLine(line)"
                :aria-label="t('features.invoices.admin.editLine', { number: index + 1 })"
                @click="isEditingLine(line) ? closeEditor() : editLine(line)"
              >
                <span class="min-w-0 flex-1 basis-40">
                  <span class="block whitespace-pre-line break-words font-medium">{{
                    line.description || t('features.invoices.admin.newLine')
                  }}</span>
                  <span class="mt-1 block text-xs text-muted"
                    >{{ quantity(line) }} {{ line.unit }} × {{ money(line.unitPriceMinor) }} ·
                    {{ t('features.invoices.admin.vat') }} {{ percentage(line) }}</span
                  >
                </span>
                <span class="flex items-center gap-2 tabular-nums"
                  ><strong class="text-sm">{{ money(amount(line)) }}</strong
                  ><UIcon name="i-lucide-pencil" class="size-4 text-muted"
                /></span>
              </button>
              <UButton
                v-if="canRemove?.(line) !== false"
                type="button"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                :disabled="lines.length <= 1"
                :aria-label="t('features.invoices.admin.removeInvoiceLine', { number: index + 1 })"
                @click="removeLine(line)"
              />
            </div>
            <div
              v-if="isEditingLine(line)"
              class="grid gap-3 border-t border-default p-4 sm:grid-cols-2 xl:grid-cols-4"
              @keydown.esc.stop.prevent="closeEditor"
            >
              <UFormField
                :name="`lines.${index}.description`"
                :label="t('features.invoices.admin.description')"
                class="sm:col-span-2 xl:col-span-4"
              >
                <UTextarea v-model="line.description" :rows="2" autoresize class="w-full" />
              </UFormField>
              <UFormField :name="`lines.${index}.quantityMilli`" :label="t('features.invoices.admin.quantity')">
                <UInputNumber
                  :model-value="line.quantityMilli / 1000"
                  :min="0.001"
                  :max="100_000"
                  :step="0.001"
                  :format-options="{ maximumFractionDigits: 3 }"
                  :increment="false"
                  :decrement="false"
                  class="w-full"
                  @update:model-value="line.quantityMilli = Math.round(Number($event ?? 0) * 1000)"
                />
              </UFormField>
              <UFormField :name="`lines.${index}.unit`" :label="t('features.invoices.admin.unit')">
                <UInput v-model="line.unit" class="w-full" />
              </UFormField>
              <UFormField :name="`lines.${index}.unitPriceMinor`" :label="t('features.invoices.admin.unitPrice')">
                <UInputNumber
                  :model-value="line.unitPriceMinor / scale"
                  :min="credit ? -1_000_000_000 / scale : 0"
                  :max="credit ? 0 : 1_000_000_000 / scale"
                  :step="1 / scale"
                  :increment="false"
                  :decrement="false"
                  :format-options="{ style: 'currency', currency }"
                  class="w-full"
                  @update:model-value="line.unitPriceMinor = Math.round(Number($event ?? 0) * scale)"
                />
              </UFormField>
              <UFormField :name="`lines.${index}.vatRateBasisPoints`" :label="t('features.invoices.admin.vatRate')">
                <UInputNumber
                  :model-value="line.vatRateBasisPoints / 10_000"
                  :min="0"
                  :max="1"
                  :step="0.0001"
                  :format-options="{ style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }"
                  :increment="false"
                  :decrement="false"
                  class="w-full"
                  @update:model-value="line.vatRateBasisPoints = Math.round(Number($event ?? 0) * 10_000)"
                />
              </UFormField>
              <div class="flex justify-end sm:col-span-2 xl:col-span-4">
                <UButton type="button" icon="i-lucide-check" variant="outline" @click="closeEditor">{{
                  t('features.invoices.admin.doneEditingLine')
                }}</UButton>
              </div>
            </div>
          </li>
        </TransitionGroup>
      </div>
    </UFormField>
    <UButton type="button" icon="i-lucide-plus" variant="outline" :disabled="lines.length >= 500" @click="addLine">{{
      t('features.invoices.admin.addLine')
    }}</UButton>
    <dl class="ml-auto grid w-full max-w-sm grid-cols-2 gap-2 text-sm tabular-nums">
      <dt>{{ t('features.invoices.admin.subtotal') }}</dt>
      <dd class="text-right">{{ money(subtotal) }}</dd>
      <dt>{{ t('features.invoices.admin.vat') }}</dt>
      <dd class="text-right">{{ money(vat) }}</dd>
      <dt class="font-semibold">{{ t('features.invoices.admin.totalPayable') }}</dt>
      <dd class="text-right font-semibold">{{ money(subtotal + vat) }}</dd>
    </dl>
  </section>
</template>

<style scoped>
.invoice-sort-move {
  transition: transform 160ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .invoice-sort-move {
    transition: none;
  }
}
</style>
