import type { ClientApprovalItemDto } from './types/timesheet'

type DashboardApproval = Pick<
  ClientApprovalItemDto,
  'id' | 'status' | 'canAct' | 'periodEndsOn' | 'reviewerUserId' | 'reviewedAt'
>

export const selectClientDashboardApprovals = <Item extends DashboardApproval>(items: Item[], userId: string) => {
  const pending = items
    .filter((item) => item.status === 'PENDING' && item.canAct)
    .sort((a, b) => b.periodEndsOn.localeCompare(a.periodEndsOn) || a.id.localeCompare(b.id))
  const history = items
    .filter((item) => item.status === 'APPROVED' && item.reviewerUserId === userId)
    .sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? '') || a.id.localeCompare(b.id))
    .slice(0, 5)
  return { pendingCount: pending.length, hasHistory: history.length > 0, items: [...pending, ...history] }
}
