export default defineAppConfig({
  ui: {
    colors: { primary: 'red', neutral: 'stone' },
    alert: { slots: { root: 'brutal-alert' } },
    authForm: { slots: { root: 'brutal-auth-form' } },
    badge: { slots: { base: 'brutal-badge' } },
    button: { slots: { base: 'brutal-button' } },
    card: { slots: { root: 'brutal-card', header: 'brutal-card-header', footer: 'brutal-card-footer' } },
    dashboardNavbar: { slots: { root: 'brutal-dashboard-navbar' } },
    dashboardPanel: { slots: { root: 'brutal-dashboard-panel' } },
    dropdownMenu: { slots: { content: 'brutal-overlay-surface', item: 'brutal-menu-item' } },
    input: { slots: { base: 'brutal-input' } },
    modal: { slots: { content: 'brutal-overlay-surface', overlay: 'brutal-overlay' } },
    navigationMenu: { slots: { link: 'brutal-navigation-link' } },
    select: { slots: { base: 'brutal-input', content: 'brutal-overlay-surface', item: 'brutal-menu-item' } },
    selectMenu: { slots: { base: 'brutal-input', content: 'brutal-overlay-surface', item: 'brutal-menu-item' } },
    skeleton: { base: 'brutal-skeleton' },
    slideover: { slots: { content: 'brutal-overlay-surface', overlay: 'brutal-overlay' } },
    table: {
      slots: { root: 'brutal-table', thead: 'brutal-table-head', th: 'brutal-table-heading', tr: 'brutal-table-row' }
    },
    tabs: { slots: { list: 'brutal-tabs-list', trigger: 'brutal-tabs-trigger', indicator: 'brutal-tabs-indicator' } },
    textarea: { slots: { base: 'brutal-input' } },
    toast: { slots: { root: 'brutal-toast' } },
    tooltip: { slots: { content: 'brutal-tooltip' } }
  }
})
