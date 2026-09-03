export const getOrganizationAvatar = (organization: { metadata?: string | null; logo?: string | null }) => {
  try {
    const metadata = JSON.parse(organization.metadata || '{}')
    if (typeof metadata?.avatarLogo === 'string' && metadata.avatarLogo) {
      return metadata.avatarLogo
    }
  } catch {
    // Older organizations may not have valid metadata.
  }
  return organization.logo || undefined
}
