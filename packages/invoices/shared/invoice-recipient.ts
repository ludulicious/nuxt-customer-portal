export const suggestedInvoiceContact = (
  source: { recipientEmail: string | null; recipientContactName: string | null },
  contacts: Array<{ id: string; name: string; email: string }>
) => {
  const normalize = (value: string | null) => value?.trim().toLowerCase() || ''
  for (const [value, field] of [
    [source.recipientEmail, 'email'],
    [source.recipientContactName, 'name']
  ] as const) {
    if (!normalize(value)) {
      continue
    }
    const matches = contacts.filter((contact) => normalize(contact[field]) === normalize(value))
    if (matches.length === 1) {
      return matches[0]!.id
    }
  }
  return contacts.length === 1 ? contacts[0]!.id : null
}
