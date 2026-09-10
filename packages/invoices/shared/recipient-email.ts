export const invoiceRecipientEmail = (
  client: { clientType: 'organization' | 'person'; invoiceEmail: string | null },
  contact?: { email: string }
): string | null => (client.clientType === 'person' ? client.invoiceEmail : (contact?.email ?? null))
