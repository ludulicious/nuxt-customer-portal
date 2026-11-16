export const invoiceSenderDetailsComplete = (profile: {
  address: string
  country: string | null
  registrationNumber: string | null
  vatNumber: string | null
  iban: string | null
  bic: string | null
  invoiceEmail: string | null
}) =>
  [
    profile.address,
    profile.country,
    profile.registrationNumber,
    profile.vatNumber,
    profile.iban,
    profile.bic,
    profile.invoiceEmail
  ].every((value) => Boolean(value?.trim()))
