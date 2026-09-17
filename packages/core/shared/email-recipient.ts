export function emailRecipientName(input: {
  firstName?: string | null
  displayName?: string | null
  email?: string | null
}) {
  return input.firstName?.trim() || input.displayName?.trim() || input.email?.trim() || ''
}
