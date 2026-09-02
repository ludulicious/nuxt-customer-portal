const dropdownContent = 'bg-default ring-1 ring-accented shadow-xl shadow-black/15 dark:shadow-black/40'
const selectItem =
  'data-highlighted:not-data-disabled:before:bg-accented data-[state=checked]:before:bg-elevated data-[state=checked]:font-medium'

export default defineAppConfig({
  ui: {
    select: {
      slots: { content: dropdownContent, item: selectItem }
    },
    selectMenu: {
      slots: { content: dropdownContent, item: selectItem }
    },
    dropdownMenu: {
      slots: {
        content: dropdownContent,
        item: 'data-highlighted:before:bg-accented data-[state=open]:before:bg-accented'
      }
    }
  }
})
