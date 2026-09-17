import type { PlanningDashboardDto } from '../../shared/types'

export const usePlanningDashboard = () =>
  useAsyncData('planning-dashboard', () => $fetch<PlanningDashboardDto>('/api/planning/dashboard'))
