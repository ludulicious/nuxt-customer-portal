/** Review months describe when hours were worked, rather than when a request was sent. */
export const reviewPeriodIncludesMonth = (period: { startsOn: string; endsOn: string }, month: string) =>
  period.startsOn.slice(0, 7) <= month && period.endsOn.slice(0, 7) >= month

export const shiftReviewMonth = (month: string, offset: -1 | 1) => {
  const [year, number] = month.split('-').map(Number)
  const index = year! * 12 + number! - 1 + offset
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`
}
