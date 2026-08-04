export const useTimesheetsDashboard = () => {
  const { activeOrganizationId } = usePortalSession()
  const { dashboard } = useTimesheets()
  return useAsyncData('timesheets-dashboard', dashboard, {
    watch: [activeOrganizationId],
    dedupe: 'defer'
  })
}
