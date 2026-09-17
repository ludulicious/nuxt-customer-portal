export const socialAuthProviderEnabled = (
  enabled: string | undefined,
  clientId: string | undefined,
  clientSecret: string | undefined
) => enabled === 'true' && Boolean(clientId?.trim()) && Boolean(clientSecret?.trim())
