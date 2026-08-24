import { db } from './db'
import { member as memberTable, organization as organizationTable } from '../db/schema/auth-schema'
import { eq, and } from 'drizzle-orm'
import { user as userRole } from '../../shared/permissions'
import type { MemberRole, Organization } from '@nuxt-customer-portal/core/shared/types/index'

// Type for role statements structure
type RoleStatements = Record<string, readonly string[]>

// Helper to extract statements from a role object
const getRoleStatements = (role: unknown): RoleStatements => {
  // Roles created with ac.newRole() may have a statements property or be the statements object itself
  if (role && typeof role === 'object' && 'statements' in role) {
    return (role as { statements: RoleStatements }).statements
  }
  return role as RoleStatements
}

/**
 * Get organization role permissions mapping
 * Organization owners get full permissions including organization management
 * Organization admins get most permissions except organization deletion
 * Members get basic service-request permissions (same as user role)
 */
export const getOrganizationRolePermissions = (orgRole: MemberRole | null | undefined): RoleStatements => {
  if (!orgRole) {
    // No organization role, return user role permissions
    return getRoleStatements(userRole)
  }

  // Get base user role permissions
  const userStatements = getRoleStatements(userRole)
  const permissions: RoleStatements = { ...userStatements }

  if (orgRole === 'owner') {
    // Owners get full organization management permissions
    permissions['organization'] = ['read', 'update', 'delete']
    permissions['member'] = ['read', 'list', 'create', 'update', 'delete', 'update-name']
    permissions['invitation'] = ['list', 'create', 'cancel', 'resend']
  } else if (orgRole === 'admin') {
    // Admins can manage members and invitations but not delete organization
    permissions['organization'] = ['read', 'update'] // No 'delete' for admins
    permissions['member'] = ['read', 'list', 'create', 'update', 'delete', 'update-name']
    permissions['invitation'] = ['list', 'create', 'cancel', 'resend']
  } else if (orgRole === 'member') {
    // Members can see the organization they belong to, but the member and
    // invitation directories are administrative data.
    permissions['organization'] = ['read']
  }

  return permissions
}

/**
 * Get the effective permissions for a user based on their system role and organization role
 */
export const getUserPermissions = async (
  userId: string,
  _systemRole: string | null | undefined,
  organizationId: string | null | undefined
): Promise<{ permissions: RoleStatements; orgRole: MemberRole | null; organization: Organization | null }> => {
  let roleDefinition: unknown = userRole
  let orgRole: MemberRole | null = null
  let organization: Organization | null = null

  if (organizationId) {
    try {
      // Get the user's role in the organization
      const [member] = await db
        .select({ role: memberTable.role })
        .from(memberTable)
        .where(and(eq(memberTable.userId, userId), eq(memberTable.organizationId, organizationId)))
        .limit(1)

      if (member) {
        orgRole = member.role as MemberRole
        roleDefinition = getOrganizationRolePermissions(orgRole)
      }

      // Get organization details
      const [org] = await db.select().from(organizationTable).where(eq(organizationTable.id, organizationId)).limit(1)

      if (org) {
        organization = org as Organization
      }
    } catch (error) {
      console.error('Error fetching organization role or details:', error)
      // Fall back to default role if there's an error
    }
  }

  const roleStatements = getRoleStatements(roleDefinition)
  return {
    permissions: roleStatements,
    orgRole,
    organization
  }
}

/**
 * Check if a user has a specific permission
 * @param userId The user ID to check
 * @param systemRole The user's system role (from user.role)
 * @param organizationId The organization ID to check permissions for (optional)
 * @param subject The permission subject (e.g., 'organization', 'member', 'invitation')
 * @param action The permission action (e.g., 'read', 'update', 'delete')
 * @returns true if the user has the permission, false otherwise
 */
export const hasPermission = async (
  userId: string,
  systemRole: string | null | undefined,
  organizationId: string | null | undefined,
  subject: string,
  action: string
): Promise<boolean> => {
  const { permissions } = await getUserPermissions(userId, systemRole, organizationId)
  const subjectPermissions = permissions[subject] || []
  return Array.isArray(subjectPermissions) && subjectPermissions.includes(action)
}

/**
 * Check if a user has permission for an organization operation
 * This is a convenience function that extracts user info from session and checks permission
 * @param session The Better Auth session object
 * @param organizationId The organization ID to check permissions for
 * @param subject The permission subject
 * @param action The permission action
 * @returns true if the user has the permission, false otherwise
 */
export const checkOrganizationPermission = async (
  session: { user: { id: string; role?: string } },
  organizationId: string,
  subject: string,
  action: string
): Promise<boolean> => {
  if (!session?.user) {
    return false
  }

  return await hasPermission(session.user.id, session.user.role, organizationId, subject, action)
}

/**
 * Get user's organization role for a specific organization
 * @param userId The user ID
 * @param organizationId The organization ID
 * @returns The organization role or null if not a member
 */
export const getUserOrganizationRole = async (userId: string, organizationId: string): Promise<MemberRole | null> => {
  try {
    const [member] = await db
      .select({ role: memberTable.role })
      .from(memberTable)
      .where(and(eq(memberTable.userId, userId), eq(memberTable.organizationId, organizationId)))
      .limit(1)

    return member ? (member.role as MemberRole) : null
  } catch (error) {
    console.error('Error fetching organization role:', error)
    return null
  }
}

/**
 * Check if a user is a member of an organization
 * System admins are considered to have access to all organizations
 * @param userId The user ID
 * @param organizationId The organization ID
 * @param systemRole The user's system role (optional, for admin check)
 * @returns true if the user is a member or is a system admin
 */
export const isOrganizationMember = async (
  userId: string,
  organizationId: string,
  _systemRole?: string | null
): Promise<boolean> => {
  const role = await getUserOrganizationRole(userId, organizationId)
  return role !== null
}
