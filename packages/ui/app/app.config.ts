const surface = 'portal-surface'
const field = { slots: { base: 'portal-field-surface' } }

export default defineAppConfig({
  portal: { sidebarNavigation: false },
  ui: {
    button: {
      compoundVariants: [
        {
          color: 'primary',
          variant: 'solid',
          class: 'text-[color:var(--portal-on-primary,var(--ui-text-inverted))]'
        }
      ]
    },
    card: { slots: { root: surface } },
    pageCard: { slots: { root: surface } },
    input: field,
    inputNumber: field,
    inputDate: field,
    inputTime: field,
    inputTags: field,
    textarea: field,
    header: { slots: { root: surface, content: surface } },
    inputMenu: { slots: { base: 'portal-field-surface', content: surface } },
    select: { slots: { base: 'portal-field-surface', content: surface } },
    selectMenu: { slots: { base: 'portal-field-surface', content: surface } },
    modal: { slots: { content: surface } },
    slideover: { slots: { content: surface } },
    popover: { slots: { content: surface } },
    toast: { slots: { root: surface } },
    editorEmojiMenu: { slots: { content: surface } },
    editorMentionMenu: { slots: { content: surface } },
    editorSuggestionMenu: { slots: { content: surface } },
    dropdownMenu: { slots: { content: surface } },
    navigationMenu: { slots: { viewport: surface } }
  }
})
