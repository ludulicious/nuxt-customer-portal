import { z } from 'zod'

export const thankYouCopySchema = z.object({
  statusLabel: z.string().trim().min(1).max(120),
  heading: z.string().trim().min(1).max(240),
  message: z.string().trim().min(1).max(4000),
  helpText: z.string().trim().max(2000),
  downloadsHeading: z.string().trim().min(1).max(120)
})
export type ThankYouCopy = z.infer<typeof thankYouCopySchema>
export type ThankYouVariant = 'free' | 'paid'

export function purchaseThankYouVariant(order: {
  total: number | null
  lines: Array<{ unit_amount: number }>
}): ThankYouVariant {
  return order.total === 0 ||
    (order.total === null && order.lines.length > 0 && order.lines.every((line) => line.unit_amount === 0))
    ? 'free'
    : 'paid'
}
