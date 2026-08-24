import { z } from 'zod'
import { registerPortalOpenApiContracts } from '@nuxt-customer-portal/core/server/utils/openapi-contracts'
import {
  activityCreateSchema,
  activityDeleteSchema,
  activityListQuerySchema,
  activityUpdateSchema,
  clientCreateSchema,
  clientDeleteSchema,
  clientListQuerySchema,
  entryCreateSchema,
  entryUpdateSchema,
  projectCreateSchema,
  projectDeleteSchema,
  projectListQuerySchema,
  projectUpdateSchema,
  reportQuerySchema,
  reviewSchema,
  settingsUpdateSchema,
  tariffUpdateSchema,
  teamMemberSettingsUpdateSchema,
  timerStartSchema,
  weekQuerySchema
} from '../utils/timesheet-validation'

export default defineNitroPlugin(() => {
  registerPortalOpenApiContracts({
    owner: 'timesheets',
    query: {
      timesheetsBootstrapGet: weekQuerySchema,
      timesheetsAdminBootstrapGet: z.object({
        section: z.enum(['approvals', 'clients', 'projects', 'activities', 'rates', 'settings', 'reports']).optional()
      }),
      timesheetsAdminActivitiesGet: activityListQuerySchema,
      timesheetsAdminClientsGet: clientListQuerySchema,
      timesheetsAdminProjectsGet: projectListQuerySchema,
      timesheetsAdminReportGet: reportQuerySchema
    },
    body: {
      timesheetsEntriesPost: entryCreateSchema,
      timesheetsEntriesByIdPatch: entryUpdateSchema,
      timesheetsTimerPost: timerStartSchema,
      timesheetsAdminClientsPost: clientCreateSchema,
      timesheetsAdminClientsByIdDelete: clientDeleteSchema,
      timesheetsAdminActivitiesPost: activityCreateSchema,
      timesheetsAdminActivitiesByIdPatch: activityUpdateSchema,
      timesheetsAdminActivitiesByIdDelete: activityDeleteSchema,
      timesheetsAdminProjectsPost: projectCreateSchema,
      timesheetsAdminProjectsByIdPatch: projectUpdateSchema,
      timesheetsAdminProjectsByIdDelete: projectDeleteSchema,
      timesheetsAdminTariffsPut: tariffUpdateSchema,
      timesheetsAdminTeamMemberPut: teamMemberSettingsUpdateSchema,
      timesheetsAdminSettingsPatch: settingsUpdateSchema,
      timesheetsAdminApprovalsByIdPost: reviewSchema
    }
  })
})
