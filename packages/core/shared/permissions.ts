import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access'

// Core portal statements. Feature authorization is owned by each feature policy.
export const statement = {
  ...defaultStatements,
  // Organization-related permissions
  organization: ['read', 'create', 'update', 'delete'],
  member: ['read', 'list', 'create', 'update', 'delete', 'update-name'],
  invitation: ['list', 'create', 'resend', 'cancel', 'delete']
} as const

// Create the access control instance
const ac = createAccessControl(statement)

// Define our roles with their permissions
export const user = ac.newRole({
  organization: ['read']
})

export const admin = ac.newRole({
  ...adminAc.statements
})

// Export the access control instance and roles
export { ac }
