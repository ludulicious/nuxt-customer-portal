/* Hallmark · component: select dropdowns · genre: modern-minimal · theme: portal-native
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50) · pre-emit critique: P5 H4 E5 S5 R5 V4
 */
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'orange',
      neutral: 'slate'
    },
    select: {
      slots: {
        base: 'hover:ring-primary/50 data-[state=open]:ring-2 data-[state=open]:ring-primary',
        content: 'border border-default bg-elevated p-1 shadow-xl ring-1 ring-accented',
        viewport: 'divide-y-0',
        group: 'space-y-1 p-0',
        item: 'rounded-md px-2.5 py-2 text-highlighted data-highlighted:not-data-disabled:bg-accented data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary'
      }
    },
    selectMenu: {
      slots: {
        base: 'hover:ring-primary/50 data-[state=open]:ring-2 data-[state=open]:ring-primary',
        content: 'border border-default bg-elevated p-1 shadow-xl ring-1 ring-accented',
        viewport: 'divide-y-0',
        group: 'space-y-1 p-0',
        input: 'mx-1 mb-1 border-b border-accented',
        item: 'rounded-md px-2.5 py-2 text-highlighted data-highlighted:not-data-disabled:bg-accented data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary'
      }
    }
  }
})
