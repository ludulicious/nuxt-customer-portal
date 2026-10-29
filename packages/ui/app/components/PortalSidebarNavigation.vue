<!-- Hallmark · component review: P4 H4 E4 S4 R4 V4 -->
<script setup lang="ts">
const props = defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ navigate: [] }>()
const { t } = useI18n()
const route = useRoute()
const mobileOpen = ref(false)
const { moduleNavigationGroups, activeModuleId } = useModuleNavigation(mobileOpen)
const { links } = useNavigationLinks(mobileOpen)
const expanded = ref<string[]>([])
const flyout = ref('')
const panel = ref<HTMLElement[]>([])
let returnFocus: HTMLElement | undefined
let leaveTimer: ReturnType<typeof setTimeout> | undefined

const standalone = computed(() => {
  const destinations = new Set(
    moduleNavigationGroups.value.flatMap((module) => [module.to, ...module.menuItems.map((item) => item.to)])
  )
  return links.value.flat().filter((item) => !destinations.has(String(item.to)))
})
watch(
  activeModuleId,
  (id) => {
    if (id && !expanded.value.includes(id)) {
      expanded.value.push(id)
    }
  },
  { immediate: true }
)
watch(
  () => route.fullPath,
  () => {
    flyout.value = ''
    if (activeModuleId.value && !expanded.value.includes(activeModuleId.value)) {
      expanded.value.push(activeModuleId.value)
    }
    emit('navigate')
  }
)
watch(
  () => props.collapsed,
  () => {
    flyout.value = ''
  }
)
function toggle(id: string) {
  expanded.value = expanded.value.includes(id)
    ? expanded.value.filter((value) => value !== id)
    : [...expanded.value, id]
}
function show(id: string) {
  clearTimeout(leaveTimer)
  flyout.value = id
}
function leave() {
  clearTimeout(leaveTimer)
  leaveTimer = setTimeout(() => {
    if (!panel.value.some((element) => element?.contains(document.activeElement))) {
      flyout.value = ''
    }
  }, 180)
}
function closeFlyout() {
  flyout.value = ''
  returnFocus?.focus()
  returnFocus = undefined
}
async function enter(id: string, event: Event) {
  returnFocus = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
  show(id)
  await nextTick()
  panel.value
    .find((element) => element?.dataset.module === id)
    ?.querySelector<HTMLElement>('a[href]')
    ?.focus()
}
onBeforeUnmount(() => clearTimeout(leaveTimer))
const badgeProps = (badge: (typeof moduleNavigationGroups.value)[number]['badge']) =>
  typeof badge === 'object' ? badge : { label: badge }
</script>

<template>
  <nav :aria-label="t('menu.moduleNavigation')" class="space-y-1" data-portal-sidebar>
    <div v-for="module in moduleNavigationGroups" :key="module.id">
      <template
        v-if="
          module.menuItems.length > 1 || (module.menuItems.length === 1 && module.menuItems[0]?.label !== module.label)
        "
      >
        <UPopover
          v-if="collapsed"
          :open="flyout === module.id"
          :content="{
            side: 'right',
            align: 'start',
            sideOffset: 12,
            collisionPadding: 12,
            onOpenAutoFocus: (event: Event) => event.preventDefault()
          }"
          :ui="{ content: 'bg-default ring-1 ring-default shadow-lg' }"
          @update:open="flyout = $event ? module.id : ''"
        >
          <template #anchor>
            <UButton
              :icon="module.icon"
              :aria-label="module.label"
              aria-haspopup="dialog"
              :aria-expanded="flyout === module.id"
              :color="module.id === activeModuleId ? 'primary' : 'neutral'"
              variant="ghost"
              class="min-h-11 w-full justify-center rounded-md"
              @click="enter(module.id, $event)"
              @pointerenter="show(module.id)"
              @pointerleave="leave"
              @keydown.down.prevent="enter(module.id, $event)"
              @keydown.right.prevent="enter(module.id, $event)"
            />
          </template>
          <template #content>
            <div
              ref="panel"
              :data-module="module.id"
              class="w-64 max-w-[calc(100vw-6rem)] p-2"
              @pointerenter="show(module.id)"
              @pointerleave="leave"
              @focusout="leave"
              @keydown.esc.prevent.stop="closeFlyout"
            >
              <div class="px-3 py-2 text-sm font-semibold text-highlighted">{{ module.label }}</div>
              <UNavigationMenu
                :items="module.menuItems"
                orientation="vertical"
                :ui="{ link: 'min-h-11 rounded-md' }"
                @click="flyout = ''"
              />
            </div>
          </template>
        </UPopover>
        <template v-else>
          <UButton
            :icon="module.icon"
            :color="module.id === activeModuleId ? 'primary' : 'neutral'"
            variant="ghost"
            class="min-h-11 w-full justify-start rounded-md px-3"
            :aria-expanded="expanded.includes(module.id)"
            :aria-controls="`sidebar-module-${module.id}`"
            @click="toggle(module.id)"
          >
            <span class="min-w-0 flex-1 truncate text-left">{{ module.label }}</span>
            <UBadge v-if="module.badge" v-bind="badgeProps(module.badge)" />
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4 shrink-0"
              :class="expanded.includes(module.id) ? 'rotate-180' : ''"
            />
          </UButton>
          <UNavigationMenu
            v-if="expanded.includes(module.id)"
            :id="`sidebar-module-${module.id}`"
            :items="module.menuItems"
            orientation="vertical"
            class="ml-5 my-1 border-l border-default pl-2"
            :ui="{ link: 'min-h-10 rounded-md' }"
          />
        </template>
      </template>
      <UTooltip v-else :text="module.label" :disabled="!collapsed" :content="{ side: 'right' }">
        <UButton
          :to="module.menuItems[0]?.to ?? module.to"
          :icon="module.icon"
          :label="collapsed ? undefined : module.label"
          :aria-label="module.label"
          :color="module.id === activeModuleId ? 'primary' : 'neutral'"
          variant="ghost"
          class="min-h-11 w-full rounded-md px-3"
          :class="collapsed ? 'justify-center' : 'justify-start'"
          @click="emit('navigate')"
        >
          <template v-if="!collapsed && (module.menuItems[0]?.badge ?? module.badge)" #trailing>
            <UBadge v-bind="badgeProps(module.menuItems[0]?.badge ?? module.badge)" />
          </template>
        </UButton>
      </UTooltip>
    </div>
    <UTooltip
      v-for="item in standalone"
      :key="String(item.to)"
      :text="item.label"
      :disabled="!collapsed"
      :content="{ side: 'right' }"
    >
      <UButton
        :to="item.to"
        :icon="item.icon"
        :label="collapsed ? undefined : item.label"
        :aria-label="item.label"
        :color="route.path === item.to ? 'primary' : 'neutral'"
        variant="ghost"
        class="min-h-11 w-full rounded-md px-3"
        :class="collapsed ? 'justify-center' : 'justify-start'"
        @click="emit('navigate')"
      />
    </UTooltip>
  </nav>
</template>
