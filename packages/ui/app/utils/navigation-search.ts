interface Destination {
  id?: string
  label?: string
  icon?: string
  to?: unknown
}
interface NavigationGroup extends Destination {
  id: string
  menuItems: Destination[]
}

/** Search the same permission-filtered destinations shown by the module menus. */
export const buildNavigationSearchGroups = (
  modules: NavigationGroup[],
  standalone: Destination[],
  fallbackLabel: string
) => {
  const seen = new Set<string>()
  const items = (destinations: Destination[], suffix?: string) =>
    destinations.flatMap((item) => {
      if (typeof item.to !== 'string' || seen.has(item.to)) {
        return []
      }
      seen.add(item.to)
      return [{ id: item.to, label: item.label, icon: item.icon, to: item.to, suffix }]
    })
  const groups = modules.map((module) => ({
    id: module.id,
    label: module.label,
    items: items([...module.menuItems, module], module.label)
  }))
  return [...groups, { id: 'navigation', label: fallbackLabel, items: items(standalone) }].filter(
    (group) => group.items.length
  )
}
