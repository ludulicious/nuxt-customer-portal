export const purchaseConfirmationEmail = {
  id: 'purchase',
  labelKey: 'products.emailPurchaseConfirmation',
  defaults: {
    en: {
      subject: 'Your purchase: {{product}}',
      body: 'Dear {{recipient_name}},\n\nThank you for your purchase of **{{product}}**. We are pleased to confirm that your order has been completed successfully.\n\n- **Booking reference:** {{bookingReference}}\n\n{{instructions}}\n\nYou can find your purchase details and any available materials in [your portal]({{url}}).',
      footer: 'Please keep this email for your records. We hope you enjoy your purchase.'
    },
    nl: {
      subject: 'Je aankoop: {{product}}',
      body: 'Beste {{recipient_name}},\n\nBedankt voor je aankoop van **{{product}}**. We bevestigen graag dat je bestelling succesvol is afgerond.\n\n- **Boekingsnummer:** {{bookingReference}}\n\n{{instructions}}\n\nJe vindt de gegevens van je aankoop en eventuele beschikbare materialen in [je portaal]({{url}}).',
      footer: 'Bewaar deze e-mail voor je administratie. We wensen je veel plezier met je aankoop.'
    }
  },
  placeholders: [
    { key: 'recipient_name', labelKey: 'admin.email.placeholders.recipientName', example: 'Alex' },
    { key: 'product', labelKey: 'products.title', example: 'Audio' },
    { key: 'bookingReference', labelKey: 'products.bookingReference', example: 'BK-7F3A9C12D4E8' },
    { key: 'instructions', labelKey: 'products.nextSteps', example: 'Welcome' },
    { key: 'url', labelKey: 'products.purchases', example: 'https://example.com/purchases' }
  ]
}
