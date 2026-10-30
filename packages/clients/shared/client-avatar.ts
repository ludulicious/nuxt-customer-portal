import { getOrganizationAvatar } from '@nuxt-customer-portal/core/shared/organization-avatar'
import type { ClientMemberDto, GenericClientDto } from './types/client'

export const getClientAvatar = (
  client: Pick<GenericClientDto, 'clientType' | 'logo'> & { metadata?: string | null },
  members: Pick<ClientMemberDto, 'role' | 'image'>[]
) => {
  if (client.clientType === 'person') {
    const owner = members.find((member) => member.role === 'owner')
    if (owner?.image) {
      return owner.image
    }
  }
  return getOrganizationAvatar(client)
}
