export type ClientModuleState = { moduleId: string, enabled: boolean }

export interface ClientMemberDto {
  id: string
  userId: string
  name: string
  email: string
  image: string | null
  role: string
  phone: string | null
  jobTitle: string | null
}

export interface GenericClientDto {
  id: string
  organizationId: string
  name: string
  slug: string
  logo: string | null
  officialName: string
  address: string
  registrationNumber: string | null
  vatNumber: string | null
  invoiceEmail: string | null
  preferredLocale: 'nl' | 'en'
  archivedAt: string | null
  modules: ClientModuleState[]
  members: ClientMemberDto[]
}

export interface ClientListResponse {
  items: GenericClientDto[]
  pagination: { page: number, pageSize: number, totalItems: number, totalPages: number, hasPrevious: boolean, hasNext: boolean }
}
