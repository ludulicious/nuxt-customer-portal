import assert from 'node:assert/strict'
import test from 'node:test'
import { buildNavigationSearchGroups } from '../../ui/app/utils/navigation-search'

test('search includes every module page, unique module landing routes and standalone destinations', () => {
  const groups = buildNavigationSearchGroups(
    [
      {
        id: 'store',
        label: 'Store',
        to: '/store',
        menuItems: [
          { label: 'Products', to: '/products' },
          { label: 'Media library', to: '/media' },
          { label: 'Store settings', to: '/settings' }
        ]
      },
      { id: 'dashboard', label: 'Dashboard', to: '/dashboard', menuItems: [{ label: 'Dashboard', to: '/dashboard' }] }
    ],
    [
      { label: 'Products', to: '/products' },
      { label: 'Profile', to: '/profile' }
    ],
    'Search'
  )
  assert.deepEqual(
    groups.flatMap((group) => group.items.map((item) => item.to)),
    ['/products', '/media', '/settings', '/store', '/dashboard', '/profile']
  )
  assert.equal(groups[0]?.items[1]?.suffix, 'Store')
})

test('empty and unavailable groups do not introduce search destinations', () => {
  assert.deepEqual(buildNavigationSearchGroups([], [], 'Search'), [])
  assert.deepEqual(buildNavigationSearchGroups([], [{ label: 'Invalid' }], 'Search'), [])
})
