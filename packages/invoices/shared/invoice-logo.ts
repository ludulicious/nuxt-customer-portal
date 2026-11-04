export const invoiceLogoCandidates = (portalLightLogo?: string | null, providerLogo?: string | null) => [
  ...new Set([portalLightLogo?.trim(), providerLogo?.trim()].filter((logo): logo is string => Boolean(logo)))
]
