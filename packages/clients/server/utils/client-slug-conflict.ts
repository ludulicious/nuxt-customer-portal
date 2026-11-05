export const rethrowClientSlugConflict = (error: unknown): never => {
  const failure = error as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } }
  const databaseError = failure?.cause ?? failure
  if (databaseError?.code === '23505' && databaseError.constraint === 'organization_slug_unique') {
    throw createError({ statusCode: 409, message: 'Organization slug already exists', data: { field: 'slug' } })
  }
  throw error
}
