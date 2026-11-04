const surface = 'portal-surface bg-(--portal-surface) text-(--portal-surface-text)'
const dropdownContent = `${surface} rounded-lg ring-1 ring-default shadow-md`
const selectItem =
  'data-highlighted:not-data-disabled:before:bg-elevated data-[state=checked]:before:bg-primary/10 data-[state=checked]:text-primary data-[state=checked]:font-medium'
const linkInteraction =
  'underline-offset-4 decoration-2 hover:underline active:underline focus-visible:underline disabled:no-underline aria-disabled:no-underline hover:disabled:no-underline hover:aria-disabled:no-underline hover:disabled:bg-transparent hover:aria-disabled:bg-transparent active:disabled:bg-transparent active:aria-disabled:bg-transparent'
const linkColors = {
  primary: 'hover:text-primary active:text-primary hover:bg-primary/10 active:bg-primary/20',
  secondary: 'hover:text-secondary active:text-secondary hover:bg-secondary/10 active:bg-secondary/20',
  success: 'hover:text-success active:text-success hover:bg-success/10 active:bg-success/20',
  info: 'hover:text-info active:text-info hover:bg-info/10 active:bg-info/20',
  warning: 'hover:text-warning active:text-warning hover:bg-warning/10 active:bg-warning/20',
  error: 'hover:text-error active:text-error hover:bg-error/10 active:bg-error/20',
  neutral:
    'hover:text-highlighted active:text-highlighted hover:bg-(--portal-surface-hover) active:bg-(--portal-surface-active)'
}
const field = {
  slots: { base: 'rounded-lg' },
  variants: {
    variant: {
      outline: 'portal-field-surface bg-(--portal-surface) text-highlighted ring ring-inset ring-accented',
      soft: 'portal-field-surface bg-(--portal-surface) text-highlighted ring ring-inset ring-accented',
      subtle: 'portal-field-surface bg-(--portal-surface) text-highlighted ring ring-inset ring-accented'
    }
  }
}
const panelVariants = {
  outline: { root: `${surface} ring ring-default` },
  soft: { root: `${surface} ring ring-default` },
  subtle: { root: `${surface} ring ring-default` }
}

export default defineAppConfig({
  portal: { sidebarNavigation: false },
  ui: {
    button: {
      slots: { base: 'rounded-lg' },
      compoundVariants: [
        {
          color: 'primary',
          variant: 'solid',
          class: 'text-[color:var(--portal-on-primary,var(--ui-text-inverted))] hover:bg-primary active:bg-primary'
        },
        {
          color: 'neutral',
          variant: 'outline',
          class:
            'bg-transparent hover:bg-(--portal-surface-hover) active:bg-(--portal-surface-active) disabled:bg-transparent aria-disabled:bg-transparent'
        },
        ...Object.entries(linkColors).map(([color, states]) => ({
          color,
          variant: 'link',
          class: `${linkInteraction} ${states}`
        }))
      ]
    },
    link: {
      compoundVariants: [
        {
          disabled: false,
          class: 'underline-offset-4 decoration-2 hover:underline active:underline focus-visible:underline'
        }
      ]
    },
    card: {
      slots: { root: 'rounded-xl shadow-none' },
      variants: { variant: panelVariants }
    },
    pageCard: {
      slots: { root: 'rounded-xl shadow-none' },
      variants: { variant: panelVariants }
    },
    input: field,
    inputNumber: field,
    inputDate: field,
    inputTime: field,
    inputTags: field,
    textarea: field,
    header: {
      slots: { root: surface, content: surface }
    },
    inputMenu: {
      ...field,
      slots: { ...field.slots, content: dropdownContent, item: selectItem }
    },
    select: {
      ...field,
      slots: { ...field.slots, content: dropdownContent, item: selectItem, arrow: 'fill-(--portal-surface)' }
    },
    selectMenu: {
      ...field,
      slots: { ...field.slots, content: dropdownContent, item: selectItem, arrow: 'fill-(--portal-surface)' }
    },
    modal: {
      slots: { content: `${surface} rounded-xl` }
    },
    slideover: {
      slots: { content: surface }
    },
    popover: {
      slots: { content: dropdownContent, arrow: 'fill-(--portal-surface)' }
    },
    toast: {
      slots: { root: surface }
    },
    editorEmojiMenu: { slots: { content: dropdownContent } },
    editorMentionMenu: { slots: { content: dropdownContent } },
    editorSuggestionMenu: { slots: { content: dropdownContent } },
    dropdownMenu: {
      slots: {
        content: dropdownContent,
        item: 'data-highlighted:before:bg-accented data-[state=open]:before:bg-accented'
      }
    },
    navigationMenu: {
      slots: {
        viewport: dropdownContent,
        arrow: 'bg-(--portal-surface)',
        link: 'focus-visible:before:outline-primary',
        childLink: 'focus-visible:before:outline-primary'
      },
      compoundVariants: [
        {
          color: 'primary',
          active: false,
          disabled: false,
          variant: 'pill',
          class: {
            link: 'hover:before:bg-primary/10 hover:text-primary',
            linkLeadingIcon: 'group-hover:text-primary',
            childLink: 'hover:before:bg-primary/10 hover:text-primary',
            childLinkIcon: 'group-hover:text-primary'
          }
        },
        {
          color: 'primary',
          active: true,
          variant: 'pill',
          class: {
            link: 'before:bg-primary/10 text-primary font-semibold',
            childLink: 'before:bg-primary/10 text-primary font-semibold'
          }
        }
      ]
    },
    tabs: {
      slots: {
        trigger: 'hover:bg-elevated'
      }
    }
  }
})
