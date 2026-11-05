export const createClientSlug = (displayName: string) =>
  displayName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160)
    .replace(/-+$/g, '')

export const isClientSlugConflict = (error: unknown) => {
  const failure = error as { status?: number; statusCode?: number; data?: { data?: { field?: string } } }
  return (failure?.statusCode === 409 || failure?.status === 409) && failure.data?.data?.field === 'slug'
}
