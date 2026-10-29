<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  cropFrame,
  cropPixels,
  defaultAdjustments,
  imageGeometry,
  type CropRect,
  type ImageAdjustments
} from '../utils/media-image-processing'

const { t } = useI18n()
const mt = useMediaText()
const props = defineProps<{
  src: string
  adjustments?: ImageAdjustments
  active?: boolean
  controlsTarget?: string
  selection?: CropRect
  appliedCrop?: CropRect
  cropSelectionRequired?: boolean
  editing?: boolean
  disabled?: boolean
  canCrop?: boolean
  aspectRatio?: number | null
  aspectRatioLabel?: string
  animationVersion?: number
}>()
const emit = defineEmits<{
  'update:crop': [CropRect]
  'update:adjustments': [ImageAdjustments]
  'edit-start': [string]
  'edit-end': [control?: string]
  dimensions: [{ width: number; height: number }]
  error: [string]
}>()
const image = ref<HTMLImageElement>()
const imageFrame = ref<HTMLElement>()
const dimensions = ref({ width: 0, height: 0 })
const settings = computed(() => props.adjustments || defaultAdjustments())
const geometry = computed(() =>
  imageGeometry(dimensions.value.width || 1, dimensions.value.height || 1, settings.value)
)
const ratios = [
  { label: mt('Original shape'), value: 'original' },
  { label: mt('Square · 1:1'), value: '1' },
  { label: mt('Landscape · 4:3'), value: '1.3333333333333333' },
  { label: mt('Wide · 16:9'), value: '1.7777777777777777' },
  { label: mt('Portrait · 3:4'), value: '0.75' }
]
const crop = computed(
  () =>
    props.selection ||
    cropFrame(
      geometry.value.width,
      geometry.value.height,
      props.canCrop === false ? null : props.aspectRatio || null,
      100,
      50,
      50
    )
)
const cropRatio = computed(
  () => (crop.value.width * geometry.value.width) / (crop.value.height * geometry.value.height)
)
const ratio = computed(() => {
  const native = geometry.value.width / geometry.value.height
  if (Math.abs(cropRatio.value - native) < 0.001) {
    return 'original'
  }
  return ratios.find((item) => Math.abs(Number(item.value) - cropRatio.value) < 0.001)?.value || 'original'
})
const zoom = computed(() => {
  const frame = cropFrame(geometry.value.width, geometry.value.height, cropRatio.value, 100, 50, 50)
  return (frame.width / crop.value.width) * 100
})
const horizontal = computed(() => (crop.value.width < 1 ? (crop.value.x / (1 - crop.value.width)) * 100 : 50))
const vertical = computed(() => (crop.value.height < 1 ? (crop.value.y / (1 - crop.value.height)) * 100 : 50))
const adjustable = computed(() => props.editing !== false && props.canCrop !== false)
const selectingCrop = computed(
  () =>
    adjustable.value &&
    (props.cropSelectionRequired ||
      !props.appliedCrop ||
      (Object.keys(crop.value) as (keyof CropRect)[]).some(
        (key) => Math.abs(crop.value[key] - props.appliedCrop![key]) > 0.000001
      ))
)
const hasCrop = computed(
  () => dimensions.value.width > 0 && (crop.value.width < 1 - 0.000001 || crop.value.height < 1 - 0.000001)
)
const output = computed(() =>
  dimensions.value.width ? cropPixels(crop.value, geometry.value.width, geometry.value.height) : undefined
)
const frameStyle = computed(() => ({
  left: `${crop.value.x * 100}%`,
  top: `${crop.value.y * 100}%`,
  width: `${crop.value.width * 100}%`,
  height: `${crop.value.height * 100}%`
}))
const previewStyle = computed(() => {
  const ratio = selectingCrop.value ? geometry.value.width / geometry.value.height : cropRatio.value
  return {
    aspectRatio: ratio,
    width: `min(100%, calc(100cqh * ${ratio}))`
  }
})
const previewImageStyle = computed(() => ({
  width: `${100 / crop.value.width}%`,
  height: `${100 / crop.value.height}%`,
  left: `${(-crop.value.x / crop.value.width) * 100}%`,
  top: `${(-crop.value.y / crop.value.height) * 100}%`
}))
const sourceStyle = computed(() => ({
  width: `${((dimensions.value.width || 1) / geometry.value.width) * 100}%`,
  height: `${((dimensions.value.height || 1) / geometry.value.height) * 100}%`,
  transform: `translate(-50%, -50%) rotate(${geometry.value.angle}deg)`,
  filter: `brightness(${settings.value.brightness / 100})`
}))
function changeAdjustment(property: 'brightness' | 'straighten', value: number | undefined) {
  if (value === undefined || props.disabled || !adjustable.value || !dimensions.value.width) {
    return
  }
  emit('edit-start', property)
  const adjustments = { ...settings.value, [property]: value }
  emit('update:adjustments', adjustments)
}
function finishSliderEdit(control: string) {
  // The slider commits keyboard edits before emitting the new value.
  void nextTick(() => emit('edit-end', control))
}
function rotate(clockwise: boolean) {
  if (props.disabled || !adjustable.value || !dimensions.value.width) {
    return
  }
  emit('edit-start', 'rotation')
  const adjustments = {
    ...settings.value,
    rotation: (settings.value.rotation + (clockwise ? 90 : 270)) % 360
  }
  emit('update:adjustments', adjustments)
  emit('edit-end')
}
function endDrag() {
  if (!drag) {
    return
  }
  drag = undefined
  emit('edit-end')
}
function change(zoomValue = zoom.value, x = horizontal.value, y = vertical.value, shape = cropRatio.value) {
  if (props.disabled || !adjustable.value || !dimensions.value.width) {
    return
  }
  emit('update:crop', cropFrame(geometry.value.width, geometry.value.height, shape, 10000 / zoomValue, x, y))
}
function changeRatio(value: string) {
  change(zoom.value, 50, 50, value === 'original' ? geometry.value.width / geometry.value.height : Number(value))
}
function zoomWithWheel(event: WheelEvent) {
  if (
    !(event.metaKey || event.ctrlKey) ||
    props.disabled ||
    !adjustable.value ||
    !dimensions.value.width ||
    event.defaultPrevented ||
    !event.cancelable ||
    !Number.isFinite(event.deltaY) ||
    event.deltaY === 0
  ) {
    return
  }

  // Only intercept the shortcut over the preview, including at the zoom limits.
  event.preventDefault()
  const unit =
    event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? (event.currentTarget as HTMLElement).clientHeight || 384 : 1
  const delta = Math.max(-100, Math.min(100, event.deltaY * unit))
  change(Math.max(100, Math.min(1000, zoom.value * Math.exp(-delta * 0.002))))
}
function ready() {
  dimensions.value = {
    width: image.value!.naturalWidth,
    height: image.value!.naturalHeight
  }
  emit('dimensions', dimensions.value)
  emit('update:crop', { ...crop.value })
  animatePreview()
}
function animatePreview() {
  if (
    props.active === false ||
    !props.animationVersion ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return
  }
  imageFrame.value?.animate?.([{ opacity: 0.65 }, { opacity: 1 }], {
    duration: 180,
    easing: 'ease-out'
  })
}
watch(
  () => props.animationVersion,
  () => {
    if (dimensions.value.width) {
      animatePreview()
    }
  },
  { flush: 'post' }
)
let drag:
  | {
      x: number
      y: number
      horizontal: number
      vertical: number
      width: number
      height: number
    }
  | undefined
function start(event: PointerEvent) {
  if (props.disabled || !adjustable.value) {
    return
  }
  const bounds = imageFrame.value!.getBoundingClientRect()
  drag = {
    x: event.clientX,
    y: event.clientY,
    horizontal: horizontal.value,
    vertical: vertical.value,
    width: bounds.width,
    height: bounds.height
  }
  ;(event.currentTarget as HTMLElement).focus()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function move(event: PointerEvent) {
  if (!drag || props.disabled) {
    return
  }
  const x =
    crop.value.width < 1 ? drag.horizontal + ((event.clientX - drag.x) / drag.width / (1 - crop.value.width)) * 100 : 50
  const y =
    crop.value.height < 1
      ? drag.vertical + ((event.clientY - drag.y) / drag.height / (1 - crop.value.height)) * 100
      : 50
  change(zoom.value, x, y)
}
function keydown(event: KeyboardEvent) {
  const step = event.shiftKey ? 10 : 2
  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step]
  }
  const direction = directions[event.key]
  if (!direction) {
    return
  }
  event.preventDefault()
  change(zoom.value, horizontal.value + direction[0], vertical.value + direction[1])
}
</script>

<template>
  <div class="image-cropper" :class="{ 'image-cropper--panel': controlsTarget }">
    <div
      class="crop-stage"
      tabindex="-1"
      :title="adjustable && !disabled ? mt('Hold Cmd or Ctrl and scroll to zoom') : undefined"
      @wheel="zoomWithWheel"
    >
      <div ref="imageFrame" class="crop-image" :class="{ 'crop-image--preview': !selectingCrop }" :style="previewStyle">
        <div class="crop-source" :style="!selectingCrop ? previewImageStyle : undefined">
          <img
            ref="image"
            :src="src"
            :style="sourceStyle"
            :draggable="false"
            :alt="selectingCrop ? mt('Image preview for cropping') : mt('Image with the selected crop')"
            @load="ready"
            @error="emit('error', 'This image could not be previewed. Choose another file.')"
          />
        </div>
        <div
          v-if="dimensions.width && selectingCrop"
          class="crop-window"
          :class="{ 'crop-window--disabled': disabled }"
          :style="frameStyle"
          :tabindex="disabled ? -1 : 0"
          role="group"
          :aria-label="mt('Crop selection. Drag or use the arrow keys to move it.')"
          :aria-disabled="disabled"
          @keydown="keydown"
          @keyup="emit('edit-end')"
          @blur="emit('edit-end')"
          @pointerdown.prevent="start"
          @pointermove="move"
          @pointerup="endDrag"
          @pointercancel="endDrag"
          @lostpointercapture="endDrag"
        >
          <span class="crop-guide vertical" /><span class="crop-guide horizontal" />
          <span class="crop-corner top-left" /><span class="crop-corner top-right" /><span
            class="crop-corner bottom-left"
          /><span class="crop-corner bottom-right" />
        </div>
      </div>
    </div>
    <div class="crop-caption">
      <span class="crop-dimensions" :style="{ visibility: output ? undefined : 'hidden' }">
        {{ output ? `${output.width} × ${output.height} px` : t('products.media.dimensions') }}
      </span>
      <span
        class="crop-instructions"
        :style="{
          visibility: (adjustable && selectingCrop && hasCrop) || canCrop === false ? undefined : 'hidden'
        }"
        :aria-hidden="!(adjustable && selectingCrop && hasCrop) && canCrop !== false"
        >{{ canCrop === false ? t('products.media.gifPreserved') : t('products.media.cropHelp') }}</span
      >
    </div>
    <Teleport :to="controlsTarget || 'body'" :disabled="!controlsTarget" defer>
      <div v-if="adjustable && (!controlsTarget || active !== false)" class="crop-controls">
        <div class="crop-shape-row">
          <UFormField v-if="!aspectRatio" :label="mt('Shape')" class="crop-shape">
            <USelect
              :model-value="ratio"
              :items="ratios"
              value-key="value"
              :disabled="disabled || !dimensions.width"
              class="w-full"
              @update:model-value="changeRatio"
            />
          </UFormField>
          <p v-else class="crop-ratio-setting">
            <UIcon name="i-lucide-lock-keyhole" />{{ mt('Shape set by your website')
            }}<strong>{{ aspectRatioLabel }}</strong>
          </p>
        </div>
        <div class="crop-zoom-row">
          <UFormField :label="mt('Zoom')" class="crop-zoom" :hint="`${(zoom / 100).toFixed(1)}×`">
            <div class="slider-with-labels">
              <USlider
                role="group"
                class="adjustment-slider"
                :model-value="zoom"
                :min="100"
                :max="1000"
                :step="10"
                :disabled="disabled || !dimensions.width"
                :aria-label="mt('Zoom')"
                @update:model-value="change($event)"
              />
              <div class="zoom-labels">
                <span>{{ mt('Show more') }}</span
                ><span>{{ mt('Show less') }}</span>
              </div>
            </div>
          </UFormField>
          <UFormField v-if="$slots['crop-actions']" :label="mt('Crop')" class="crop-zoom-actions">
            <slot name="crop-actions" />
          </UFormField>
        </div>
        <UFormField :label="mt('Rotate')" class="image-property">
          <div class="rotate-actions">
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              icon="i-lucide-rotate-ccw"
              :aria-label="mt('Rotate left')"
              :disabled="disabled || !dimensions.width"
              @click="rotate(false)"
              >{{ mt('Left') }}</UButton
            >
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              icon="i-lucide-rotate-cw"
              :aria-label="mt('Rotate right')"
              :disabled="disabled || !dimensions.width"
              @click="rotate(true)"
              >{{ mt('Right') }}</UButton
            >
          </div>
        </UFormField>
        <UFormField
          :label="mt('Brightness')"
          class="image-property"
          :hint="
            settings.brightness === 100
              ? t('products.media.original')
              : `${settings.brightness > 100 ? '+' : ''}${settings.brightness - 100}%`
          "
        >
          <div class="slider-with-labels">
            <USlider
              role="group"
              class="adjustment-slider"
              :model-value="settings.brightness"
              :min="50"
              :max="150"
              :step="1"
              :disabled="disabled || !dimensions.width"
              :aria-label="mt('Brightness')"
              @update:model-value="changeAdjustment('brightness', $event)"
              @change="finishSliderEdit('brightness')"
            />
            <div class="zoom-labels">
              <span>{{ mt('Darker') }}</span
              ><span>{{ mt('Brighter') }}</span>
            </div>
          </div>
        </UFormField>
        <UFormField
          :label="mt('Straighten')"
          class="image-property image-property--straighten"
          :hint="`${settings.straighten}°`"
        >
          <div class="slider-with-labels">
            <USlider
              role="group"
              class="adjustment-slider"
              :model-value="settings.straighten"
              :min="-15"
              :max="15"
              :step="0.5"
              :disabled="disabled || !dimensions.width"
              :aria-label="mt('Straighten')"
              @update:model-value="changeAdjustment('straighten', $event)"
              @change="finishSliderEdit('straighten')"
            />
            <div class="zoom-labels">
              <span>{{ mt('Tilt left') }}</span
              ><span>{{ mt('Tilt right') }}</span>
            </div>
          </div>
        </UFormField>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Hallmark · component: image cropper · genre: modern-minimal · design-system: design.md
 * pre-emit critique: P5 H5 E4 S5 R5 V4 */
.image-cropper {
  container-type: inline-size;
  --crop-preview-height: clamp(12rem, 50vw, 24rem);
  --crop-preview-padding: var(--space-sm);
  min-width: 0;
}
.crop-stage {
  container-type: size;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-paper);
  color: var(--color-ink);
  border: var(--rule-thin) solid var(--color-rule);
  border-radius: var(--radius-card);
  padding: var(--crop-preview-padding);
  height: calc(var(--crop-preview-height) + 2 * var(--crop-preview-padding) + 2 * var(--rule-thin));
  overflow: hidden;
}
.crop-image {
  position: relative;
  display: inline-flex;
  max-width: 100%;
  overflow: hidden;
}
.crop-source {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.crop-image img {
  position: absolute;
  left: 50%;
  top: 50%;
  max-width: none;
  max-height: none;
  user-select: none;
}
.crop-window:focus-visible {
  outline: var(--rule-focus) solid var(--color-focus);
  outline-offset: calc(-1 * var(--rule-focus));
}
.crop-window--disabled {
  cursor: default;
}
.crop-ratio-setting {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2xs);
  align-items: center;
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  margin: 0;
}
.crop-controls {
  display: grid;
  gap: var(--space-sm);
}
.crop-zoom-row {
  display: grid;
  gap: var(--space-2xs) var(--space-sm);
}
.slider-with-labels {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-3xs);
  min-height: var(--control-height);
}
.adjustment-slider {
  min-height: var(--space-sm);
}
.rotate-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2xs);
}
.zoom-labels {
  display: flex;
  justify-content: space-between;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  margin-top: 0;
}
@container image-adjustments (min-width: 26rem) {
  .crop-controls {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: var(--space-xs);
  }
  .crop-controls > * {
    min-width: 0;
  }
  .crop-shape-row,
  .crop-zoom-row {
    grid-column: 1 / -1;
  }
  .crop-shape {
    width: calc((100% - var(--space-sm)) / 2);
  }
  .crop-zoom-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas: 'actions zoom';
  }
  .crop-zoom {
    grid-area: zoom;
  }
  .crop-zoom-actions {
    grid-area: actions;
  }
  .crop-controls > .image-property--straighten {
    grid-column: 2;
  }
}
.crop-window {
  position: absolute;
  border: var(--rule-thin) solid var(--color-accent-ink);
  box-shadow: 0 0 0 100vmax var(--color-backdrop);
  cursor: move;
  touch-action: none;
}
.crop-guide {
  position: absolute;
  opacity: 0.5;
}
.crop-guide.vertical {
  inset: 0 33.333%;
  border-inline: var(--rule-thin) solid var(--color-accent-ink);
}
.crop-guide.horizontal {
  inset: 33.333% 0;
  border-block: var(--rule-thin) solid var(--color-accent-ink);
}
.crop-corner {
  position: absolute;
  width: var(--space-sm);
  height: var(--space-sm);
  border-color: var(--color-accent-ink);
  border-style: solid;
}
.top-left {
  top: 0;
  left: 0;
  border-width: 3px 0 0 3px;
}
.top-right {
  top: 0;
  right: 0;
  border-width: 3px 3px 0 0;
}
.bottom-left {
  bottom: 0;
  left: 0;
  border-width: 0 0 3px 3px;
}
.bottom-right {
  bottom: 0;
  right: 0;
  border-width: 0 3px 3px 0;
}
.crop-caption {
  display: grid;
  gap: var(--space-3xs);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  margin: var(--space-xs) 0 var(--space-lg);
}
.crop-dimensions {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.crop-instructions {
  height: 3.1em;
}
@media (max-width: 414px) {
  .image-cropper {
    --crop-preview-padding: var(--space-2xs);
  }
}
</style>
