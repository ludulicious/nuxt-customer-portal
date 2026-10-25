export const socialAuthProviderEnabled = (
  enabled: string | undefined,
  clientId: string | undefined,
  clientSecret: string | undefined
) => enabled === 'true' && Boolean(clientId?.trim()) && Boolean(clientSecret?.trim())

export const socialAuthProviders = (env: Record<string, string | undefined>) => ({
  googleEnabled: socialAuthProviderEnabled(env.PORTAL_GOOGLE_ENABLED, env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
  githubEnabled: socialAuthProviderEnabled(env.PORTAL_GITHUB_ENABLED, env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET)
})
