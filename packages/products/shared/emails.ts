export const storeOrderNotificationEmail = {
  id: 'store-order-new',
  labelKey: 'products.emailStoreOrderNotification',
  defaults: {
    en: {
      subject: 'New order: {{product}}',
      body: 'Dear {{recipient_name}},\n\nA new order has been received.\n\n- **Customer:** {{customer_name}} ({{customer_email}})\n- **Items:** {{product}}\n- **Booking reference:** {{bookingReference}}\n\n[View the order]({{url}}).',
      footer: 'Payment and fulfillment details are available in the portal.'
    },
    nl: {
      subject: 'Nieuwe bestelling: {{product}}',
      body: 'Beste {{recipient_name}},\n\nEr is een nieuwe bestelling ontvangen.\n\n- **Klant:** {{customer_name}} ({{customer_email}})\n- **Producten:** {{product}}\n- **Boekingsnummer:** {{bookingReference}}\n\n[Bekijk de bestelling]({{url}}).',
      footer: 'Betaal- en leveringsgegevens zijn beschikbaar in het portaal.'
    }
  },
  placeholders: [
    { key: 'recipient_name', labelKey: 'admin.email.placeholders.recipientName', example: 'Alex' },
    { key: 'customer_name', labelKey: 'products.adminOrder.customer', example: 'Sam' },
    { key: 'customer_email', labelKey: 'products.email', example: 'sam@example.com' },
    { key: 'product', labelKey: 'products.title', example: 'Consultation' },
    { key: 'bookingReference', labelKey: 'products.bookingReference', example: 'BK-7F3A9C12D4E8' },
    { key: 'url', labelKey: 'products.orders', example: 'https://example.com/admin/products/orders/order-id' }
  ]
}

export const purchaseConfirmationEmail = {
  id: 'purchase',
  labelKey: 'products.emailPurchaseConfirmation',
  defaults: {
    en: {
      subject: 'Your purchase: {{product}}',
      body: 'Dear {{recipient_name}},\n\nThank you for your purchase of **{{product}}**. We are pleased to confirm that your order has been completed successfully.\n\n- **Booking reference:** {{bookingReference}}\n\n{{instructions}}\n\n{{#if downloads}}You can access your purchased files and links here:\n\n{{downloads}}\n{{/if}}\n\n[View your order, downloads and media]({{orderUrl}}). No portal account is needed.',
      footer: 'Please keep this email for your records. We hope you enjoy your purchase.'
    },
    nl: {
      subject: 'Je aankoop: {{product}}',
      body: 'Beste {{recipient_name}},\n\nBedankt voor je aankoop van **{{product}}**. We bevestigen graag dat je bestelling succesvol is afgerond.\n\n- **Boekingsnummer:** {{bookingReference}}\n\n{{instructions}}\n\n{{#if downloads}}Je vindt je gekochte bestanden en links hier:\n\n{{downloads}}\n{{/if}}\n\n[Bekijk je bestelling, downloads en media]({{orderUrl}}). Je hebt geen portaalaccount nodig.',
      footer: 'Bewaar deze e-mail voor je administratie. We wensen je veel plezier met je aankoop.'
    }
  },
  placeholders: [
    { key: 'recipient_name', labelKey: 'admin.email.placeholders.recipientName', example: 'Alex' },
    { key: 'product', labelKey: 'products.title', example: 'Audio' },
    { key: 'bookingReference', labelKey: 'products.bookingReference', example: 'BK-7F3A9C12D4E8' },
    { key: 'instructions', labelKey: 'products.nextSteps', example: 'Welcome' },
    { key: 'downloads', labelKey: 'products.purchasedFiles', example: '[Download](https://example.com/file)' },
    {
      key: 'orderUrl',
      labelKey: 'products.clientOrderLink',
      example: 'https://example.com/store/orders/private-purchase-token'
    },
    { key: 'url', labelKey: 'products.purchases', example: 'https://example.com/purchases' }
  ]
}
