export function parseSystemAdminEmails(value: string | undefined) {
  return new Set((value || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean))
}

export function isSystemAdminEmail(email: string | null | undefined, allowlist: ReadonlySet<string>) {
  return Boolean(email && allowlist.has(email.trim().toLowerCase()))
}
