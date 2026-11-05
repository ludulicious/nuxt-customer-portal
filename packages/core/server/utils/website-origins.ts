import { websiteOriginsSchema } from '../../shared/website-origins'

let resolver: (() => Promise<string[]>) | undefined

export const registerWebsiteOriginsResolver = (value: typeof resolver) => {
  resolver = value
}

export async function resolveWebsiteOrigins(includeSettings = true): Promise<string[]> {
  const environment = (process.env.PORTAL_AUTH_WEBSITE_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const stored = includeSettings && resolver ? await resolver() : []
  return websiteOriginsSchema.parse([...environment, ...stored])
}
