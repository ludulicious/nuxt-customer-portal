<script setup lang="ts">
import { z } from 'zod'
import type { Editor } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { useFormField, inputIdInjectionKey } from '#ui/composables/useFormField'
import { parseVisualMarkdown } from '../utils/visual-markdown'
import { createProtectedMarkdown, insertMarkdownPlaceholder, MarkdownPlaceholder } from '../utils/protected-markdown'

const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    rows?: number
    placeholder?: string
    placeholders?: Array<{ label: string; value: string }>
  }>(),
  { rows: 8, placeholders: () => [] }
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()
const source = ref(false)
const sourceElement = ref<{ textareaRef?: HTMLTextAreaElement }>()
const { id, disabled, color, ariaAttrs, emitFormInput, emitFormBlur, emitFormFocus } = useFormField(props)
// Toolbar controls must not inherit or replace the Markdown field's input ID.
provide(inputIdInjectionKey, ref(undefined))
const pickerId = useId()
const notice = ref(false)
let syncing = false
function update(value: string) {
  emit('update:modelValue', value)
  emitFormInput()
}
const protectedMarkdown = createProtectedMarkdown(
  () => syncing,
  () => {
    notice.value = true
  }
)
const editor = useEditor({
  extensions: [
    StarterKit.configure({ underline: false, strike: false, link: { openOnClick: false } }),
    Markdown,
    protectedMarkdown,
    MarkdownPlaceholder
  ],
  content: parseVisualMarkdown(props.modelValue),
  editable: !disabled.value,
  editorProps: { attributes: { role: 'textbox', 'aria-multiline': 'true', class: 'p-3 outline-none min-h-32' } },
  onCreate: ({ editor }) => {
    editor.markdown!.parse = parseVisualMarkdown
    editor.setOptions({
      editorProps: {
        attributes: {
          id: id.value || '',
          ...ariaAttrs.value,
          role: 'textbox',
          'aria-multiline': 'true',
          class: 'p-3 outline-none min-h-32'
        }
      }
    })
  },
  onUpdate: ({ editor }) => {
    if (!syncing) {
      update(editor.getMarkdown())
    }
  },
  onFocus: emitFormFocus,
  onBlur: emitFormBlur
})
function syncContent() {
  if (!editor.value) {
    return
  }
  syncing = true
  try {
    editor.value.commands.setContent(parseVisualMarkdown(props.modelValue), { emitUpdate: false })
  } finally {
    syncing = false
  }
}
watch(
  () => props.modelValue,
  (value) => {
    if (!source.value && editor.value?.getMarkdown() !== value) {
      syncContent()
    }
  }
)
watch(source, (raw) => {
  notice.value = false
  if (!raw) {
    syncContent()
  }
})
watch(disabled, (value) => editor.value?.setEditable(!value))
watch(
  [id, ariaAttrs],
  () =>
    editor.value?.setOptions({
      editorProps: {
        attributes: {
          id: id.value || '',
          ...ariaAttrs.value,
          role: 'textbox',
          'aria-multiline': 'true',
          class: 'p-3 outline-none min-h-32'
        }
      }
    }),
  { immediate: true }
)
const toolbarItems = computed(() => [
  [
    { kind: 'undo' as const, icon: 'i-lucide-undo-2', tooltip: { text: t('portalMarkdown.undo') } },
    { kind: 'redo' as const, icon: 'i-lucide-redo-2', tooltip: { text: t('portalMarkdown.redo') } }
  ],
  [
    {
      kind: 'mark' as const,
      mark: 'bold' as const,
      icon: 'i-lucide-bold',
      tooltip: { text: t('portalMarkdown.bold') }
    },
    {
      kind: 'mark' as const,
      mark: 'italic' as const,
      icon: 'i-lucide-italic',
      tooltip: { text: t('portalMarkdown.italic') }
    },
    { kind: 'mark' as const, mark: 'code' as const, icon: 'i-lucide-code', tooltip: { text: t('portalMarkdown.code') } }
  ],
  [
    {
      icon: 'i-lucide-heading',
      'aria-label': t('portalMarkdown.heading'),
      items: [
        { kind: 'paragraph' as const, label: t('portalMarkdown.paragraph') },
        ...([1, 2, 3, 4, 5, 6] as const).map((level) => ({
          kind: 'heading' as const,
          level,
          label: t('portalMarkdown.headingLevel', { level })
        }))
      ]
    }
  ],
  ...(['bulletList', 'orderedList', 'blockquote', 'codeBlock', 'horizontalRule'] as const).map((kind, index) => [
    {
      kind,
      icon: ['i-lucide-list', 'i-lucide-list-ordered', 'i-lucide-quote', 'i-lucide-square-code', 'i-lucide-minus'][
        index
      ],
      tooltip: { text: t(`portalMarkdown.${kind}`) }
    }
  ])
])
const toolbar = computed(() =>
  toolbarItems.value.map((group) =>
    group.map((item) => ({
      ...item,
      'aria-label': 'tooltip' in item ? item.tooltip.text : t('portalMarkdown.heading')
    }))
  )
)
const hasProtected = computed(() => {
  return (
    props.modelValue && parseVisualMarkdown(props.modelValue).content?.some((node) => node.type === 'protectedMarkdown')
  )
})
const selectedPlaceholder = ref<string>()
function insertPlaceholder(value: string) {
  if (disabled.value) {
    return
  }
  if (source.value) {
    const textarea = sourceElement.value?.textareaRef
    const start = textarea?.selectionStart ?? props.modelValue.length
    const end = textarea?.selectionEnd ?? start
    const inserted = insertMarkdownPlaceholder(props.modelValue, value, start, end)
    update(inserted.value)
    nextTick(() => {
      textarea?.focus()
      textarea?.setSelectionRange(inserted.cursor, inserted.cursor)
    })
  } else {
    editor.value
      ?.chain()
      .focus()
      .insertContent(
        editor.value.isActive('codeBlock')
          ? { type: 'text', text: value }
          : { type: 'markdownPlaceholder', attrs: { raw: value } }
      )
      .run()
  }
  nextTick(() => {
    selectedPlaceholder.value = undefined
  })
}
const linkOpen = ref(false)
const linkState = reactive({ url: '' })
// Link validation is shared with the server's allowed Markdown link schemes.
const linkSchema = z.object({
  url: z
    .string()
    .trim()
    .regex(/^(https?:\/\/|mailto:|\/|#)/i, t('portalMarkdown.invalidLink'))
})
function applyLink() {
  if (disabled.value) {
    return
  }
  editor.value?.chain().focus().extendMarkRange('link').setLink({ href: linkState.url.trim() }).run()
  linkOpen.value = false
}
function removeLink() {
  if (disabled.value) {
    return
  }
  editor.value?.chain().focus().unsetLink().run()
  linkOpen.value = false
}
function openLink(instance: Editor) {
  linkState.url = instance.getAttributes('link').href || ''
  linkOpen.value = true
}
onBeforeUnmount(() => editor.value?.destroy())
</script>

<template>
  <div class="w-full rounded-md border overflow-hidden" :class="color === 'error' ? 'border-error' : 'border-default'">
    <div class="flex flex-wrap items-center gap-2 border-b border-default p-2">
      <UButton
        type="button"
        color="neutral"
        :variant="!source ? 'soft' : 'ghost'"
        :aria-pressed="!source"
        @click="source = false"
        >{{ t('portalMarkdown.visual') }}</UButton
      >
      <UButton
        type="button"
        color="neutral"
        :variant="source ? 'soft' : 'ghost'"
        :aria-pressed="source"
        @click="source = true"
        >{{ t('portalMarkdown.source') }}</UButton
      >
      <USelect
        v-if="placeholders.length"
        :id="pickerId"
        v-model="selectedPlaceholder"
        :items="placeholders"
        :placeholder="t('portalMarkdown.insertPlaceholder')"
        :aria-label="t('portalMarkdown.insertPlaceholder')"
        :disabled="disabled"
        @update:model-value="insertPlaceholder(String($event))"
      />
    </div>
    <UTextarea
      v-if="source"
      :id="id"
      ref="sourceElement"
      v-bind="ariaAttrs"
      :model-value="modelValue"
      :rows="rows"
      :disabled="disabled"
      :placeholder="placeholder"
      class="w-full font-mono"
      :ui="{ base: 'rounded-none ring-0' }"
      @update:model-value="update(String($event))"
      @focus="emitFormFocus"
      @blur="emitFormBlur"
    />
    <ClientOnly v-else>
      <div v-if="editor">
        <div v-if="!disabled" class="flex flex-wrap items-center border-b border-default p-1">
          <UEditorToolbar :editor="editor" :items="toolbar" class="flex-wrap" />
          <UButton
            type="button"
            icon="i-lucide-link"
            color="neutral"
            variant="ghost"
            :aria-label="t('portalMarkdown.link')"
            @click="openLink(editor)"
          />
        </div>
        <p v-if="hasProtected || notice" class="px-3 pt-2 text-xs text-muted" role="status">
          {{ t('portalMarkdown.protected') }}
        </p>
        <EditorContent :editor="editor" class="portal-markdown-content" :style="{ minHeight: `${rows * 1.5}rem` }" />
      </div>
      <template #fallback
        ><div class="p-3 whitespace-pre-wrap">{{ modelValue }}</div></template
      >
    </ClientOnly>
    <UModal v-if="linkOpen" v-model:open="linkOpen" :title="t('portalMarkdown.link')">
      <template #body>
        <UForm :state="linkState" :schema="linkSchema" novalidate class="space-y-4" @submit="applyLink">
          <UFormField name="url" :label="t('portalMarkdown.linkAddress')"
            ><UInput v-model="linkState.url" autofocus class="w-full"
          /></UFormField>
          <div class="flex gap-2">
            <UButton type="submit">{{ t('portalMarkdown.applyLink') }}</UButton>
            <UButton type="button" color="neutral" variant="outline" @click="removeLink">{{
              t('portalMarkdown.removeLink')
            }}</UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.portal-markdown-content :deep(p),
.portal-markdown-content :deep(ul),
.portal-markdown-content :deep(ol),
.portal-markdown-content :deep(pre),
.portal-markdown-content :deep(blockquote) {
  margin-block: 0.6em;
}
.portal-markdown-content :deep(ul) {
  list-style: disc;
  padding-left: 1.5rem;
}
.portal-markdown-content :deep(ol) {
  list-style: decimal;
  padding-left: 1.5rem;
}
.portal-markdown-content :deep(h1),
.portal-markdown-content :deep(h2),
.portal-markdown-content :deep(h3),
.portal-markdown-content :deep(h4),
.portal-markdown-content :deep(h5),
.portal-markdown-content :deep(h6) {
  font-weight: 600;
  margin-block: 0.8em 0.4em;
}
.portal-markdown-content :deep(h1) {
  font-size: 1.8em;
}
.portal-markdown-content :deep(h2) {
  font-size: 1.5em;
}
.portal-markdown-content :deep(h3) {
  font-size: 1.25em;
}
.portal-markdown-content :deep(a) {
  color: var(--ui-primary);
  text-decoration: underline;
}
.portal-markdown-content :deep(blockquote) {
  border-left: 3px solid var(--ui-border);
  padding-left: 1rem;
}
.portal-markdown-content :deep(pre) {
  background: var(--ui-bg-muted);
  padding: 0.75rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.portal-markdown-content :deep(code) {
  font-family: monospace;
  background: var(--ui-bg-muted);
}
.portal-markdown-content :deep(hr) {
  margin-block: 1rem;
  border-color: var(--ui-border);
}
</style>
