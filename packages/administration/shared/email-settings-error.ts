export const emailSettingsErrorMessage = (error: unknown): string => {
  const response = (error as { data?: { data?: { code?: string; message?: string } } } | null)?.data?.data
  return response?.code === 'EMAIL_ENCRYPTION_CONFIGURATION' && typeof response.message === 'string'
    ? response.message
    : String(error)
}
