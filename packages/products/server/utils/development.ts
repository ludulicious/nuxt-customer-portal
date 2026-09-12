export function developmentSandboxEffectsEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.IS_DEVELOPMENT === 'true'
}
