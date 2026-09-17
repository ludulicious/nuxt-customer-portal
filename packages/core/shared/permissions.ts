import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access'
import {
  defaultStatements as organizationDefaultStatements,
  adminAc as organizationAdminAc,
  memberAc as organizationMemberAc,
  ownerAc as organizationOwnerAc
} from 'better-auth/plugins/organization/access'

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

export const organizationStatement = {
  ...organizationDefaultStatements,
  apiKey: ['create', 'read', 'update', 'delete']
} as const

export const organizationAc = createAccessControl(organizationStatement)
export const organizationOwner = organizationAc.newRole({
  ...organizationOwnerAc.statements,
  apiKey: ['create', 'read', 'update', 'delete']
})
export const organizationAdmin = organizationAc.newRole({
  ...organizationAdminAc.statements,
  apiKey: ['create', 'read', 'update', 'delete']
})
export const organizationMember = organizationAc.newRole({
  ...organizationMemberAc.statements,
  apiKey: []
})
