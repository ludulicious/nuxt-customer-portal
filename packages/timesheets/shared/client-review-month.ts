/** Review months describe when hours were worked, rather than when a request was sent. */
export const reviewPeriodIncludesMonth = (period: { startsOn: string; endsOn: string }, month: string) =>
  period.startsOn.slice(0, 7) <= month && period.endsOn.slice(0, 7) >= month

export const shiftReviewMonth = (month: string, offset: -1 | 1) => {
  const [year, number] = month.split('-').map(Number)
  const index = year! * 12 + number! - 1 + offset
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** Empty periods are useful only for active clients still registering time. */
export const showReviewPeriod = (
  period: { timeTrackingEnabled: boolean; availableCount: number; outstandingCount: number },
  showEmpty: boolean
) => period.availableCount > 0 || period.outstandingCount > 0 || (showEmpty && period.timeTrackingEnabled)

/** The API includes active tracked clients and clients with recorded work in this month. */
export const reviewClientOptions = (
  periods: Array<{ workspaceClientId: string; clientName: string }>,
  requests: Array<{ workspaceClientId: string; clientName: string }>
) => {
  const clients = new Map<string, string>()
  for (const client of [...periods, ...requests]) {
    clients.set(client.workspaceClientId, client.clientName)
  }
  return [...clients].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
}
