export const mondayFor = (dateString?: string) => {
  const date = dateString ? new Date(`${dateString}T12:00:00Z`) : new Date()
  const day = date.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export const addIsoDays = (dateString: string, days: number) => {
  const date = new Date(`${dateString}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
