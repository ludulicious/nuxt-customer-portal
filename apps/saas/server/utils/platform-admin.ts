const platformAdminEmails = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
)

export const isPlatformAdminEmail = (email: string | null | undefined) =>
  Boolean(email && platformAdminEmails.has(email.trim().toLowerCase()))
