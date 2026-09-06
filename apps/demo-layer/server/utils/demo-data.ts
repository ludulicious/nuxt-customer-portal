import type { PoolClient } from 'pg'
import { demoIdentities } from './identities'

// Deliberately fictional identifiers, never usable for real payments or tax reporting.
export const demoInvoiceSender = {
  address: 'Example Street 12\n1000 AA Amsterdam\nNetherlands',
  registrationNumber: '00000000',
  vatNumber: 'NL000000000B00',
  iban: 'NL00DEMO0000000000',
  bic: 'DEMONL2A',
  invoiceEmail: 'billing@example.test'
} as const

export const demoDay = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)

// Find the next local date boundary, including 23-hour and 25-hour DST days.
export function nextDemoReset(now = new Date()): Date {
  const day = demoDay(now)
  let low = now.getTime(),
    high = low + 27 * 3600000
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2)
    if (demoDay(new Date(mid)) === day) {
      low = mid
    } else {
      high = mid
    }
  }
  return new Date(high)
}

export async function seedDemoData(client: PoolClient, day: string) {
  const now = new Date(`${day}T12:00:00Z`)
  const ago = (days: number) => new Date(now.getTime() - days * 86400000)
  const date = (days: number) => ago(days).toISOString().slice(0, 10)
  const insert = async (table: string, row: Record<string, unknown>) => {
    const keys = Object.keys(row)
    await client.query(
      `INSERT INTO ${table} (${keys.map((key) => `"${key}"`).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`,
      Object.values(row)
    )
  }
  for (const [id, name, type] of [
    ['demo-studio', 'Northstar Studio', 'PROVIDER'],
    ['demo-garden', 'Greenhouse Collective', 'CLIENT'],
    ['demo-cycle', 'Canal Cycle Company', 'CLIENT']
  ]) {
    await insert('public.organization', {
      id,
      name,
      slug: id,
      logo: `/demo/logos/${id}.svg`,
      organization_type: type,
      created_at: ago(190)
    })
  }
  for (const person of demoIdentities) {
    await insert('public."user"', {
      id: person.id,
      name: person.name,
      image: `/demo/avatars/${person.id}.svg`,
      email: `${person.id}@example.test`,
      email_verified: true,
      role: person.role,
      created_at: ago(190)
    })
    // No password or OAuth token exists; credentials cannot be used outside demo sessions.
    await insert('public.account', {
      id: person.id,
      account_id: person.id,
      user_id: person.id,
      provider_id: 'credential',
      updated_at: now
    })
    await insert('public.member', {
      id: person.id,
      organization_id: person.organizationId,
      user_id: person.id,
      role: person.memberRole,
      job_title: person.label,
      created_at: ago(190)
    })
  }
  await insert('public.invitation', {
    id: 'demo-invitation',
    organization_id: 'demo-garden',
    email: 'new-colleague@example.test',
    role: 'member',
    inviter_id: 'demo-client-owner',
    expires_at: ago(-7),
    created_at: ago(1)
  })
  await insert('timesheets.workspace_settings', { organization_id: 'demo-studio', workspace_enabled: true })
  await insert('invoices.settings', {
    organization_id: 'demo-studio',
    enabled: true,
    address: demoInvoiceSender.address,
    registration_number: demoInvoiceSender.registrationNumber,
    vat_number: demoInvoiceSender.vatNumber,
    iban: demoInvoiceSender.iban,
    bic: demoInvoiceSender.bic,
    invoice_email: demoInvoiceSender.invoiceEmail
  })
  for (const [id, name, address] of [
    ['demo-garden', 'Greenhouse Collective', 'Sample Lane 8, Utrecht'],
    ['demo-cycle', 'Canal Cycle Company', 'Fictional Quay 24, Amsterdam']
  ]) {
    await insert('clients.client_profile', {
      organization_id: id,
      official_name: name,
      address,
      invoice_email: `${id}@example.test`
    })
    for (const module of ['timesheets', 'invoices', 'service-requests']) {
      await insert('clients.client_module', {
        id: `${id}-${module}`,
        organization_id: id,
        module_id: module,
        enabled_by_id: 'demo-admin'
      })
    }
    await insert('timesheets.workspace_client', {
      id,
      workspace_organization_id: 'demo-studio',
      client_organization_id: id,
      access_mode: 'REVIEW'
    })
    await insert('invoices.client_access', { id, provider_organization_id: 'demo-studio', client_organization_id: id })
    await insert('invoices.billing_contact', {
      id,
      organization_id: id,
      name: id === 'demo-garden' ? 'Noor Jansen' : 'Finance team',
      email: `${id}@example.test`
    })
    await insert('timesheets.project', {
      id,
      organization_id: 'demo-studio',
      client_organization_id: id,
      name: id === 'demo-garden' ? 'Customer portal redesign' : 'Fleet booking platform',
      code: id === 'demo-garden' ? 'GH-2026' : 'CC-2026',
      starts_on: date(190),
      budget_minutes: 50000,
      budget_minor: 7500000
    })
  }
  for (const id of ['demo-client-owner', 'demo-client-admin', 'demo-client-member']) {
    await insert('timesheets.workspace_client_reviewer', {
      id,
      workspace_client_id: 'demo-garden',
      user_id: id,
      created_by_id: 'demo-admin'
    })
    await insert('invoices.client_viewer', { id, access_id: 'demo-garden', user_id: id, created_by_id: 'demo-admin' })
  }
  for (const [id, name, billable] of [
    ['design', 'Product design', true],
    ['development', 'Development', true],
    ['planning', 'Team planning', false]
  ] as const) {
    await insert('timesheets.activity_type', { id: `demo-${id}`, organization_id: 'demo-studio', name, billable })
    for (const project of ['demo-garden', 'demo-cycle']) {
      await insert('timesheets.project_activity', {
        id: `${project}-${id}`,
        project_id: project,
        activity_type_id: `demo-${id}`
      })
    }
  }
  for (const person of demoIdentities.filter((person) => person.organizationId === 'demo-studio')) {
    await insert('timesheets.team_tariff', {
      id: person.id,
      organization_id: 'demo-studio',
      user_id: person.id,
      hourly_rate_minor: 9500
    })
    await insert('timesheets.team_member_settings', {
      id: person.id,
      organization_id: 'demo-studio',
      user_id: person.id
    })
    if (person.id !== 'demo-manager') {
      await insert('timesheets.internal_approver_assignment', {
        id: person.id,
        organization_id: 'demo-studio',
        submitter_user_id: person.id,
        approver_user_id: 'demo-manager',
        created_by_id: 'demo-admin'
      })
    }
    const monday = new Date(now)
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
    for (let week = 0; week < 28; week++) {
      const start = new Date(monday.getTime() - week * 7 * 86400000)
      const end = new Date(start.getTime() + 6 * 86400000)
      const id = `${person.id}-week-${week}`
      const status = week === 0 ? 'DRAFT' : week === 1 ? 'SUBMITTED' : week === 2 ? 'REJECTED' : 'APPROVED'
      const reviewed = ['APPROVED', 'REJECTED'].includes(status)
      const timestamps = { created_at: start, updated_at: week ? end : now }
      const review = {
        submitted_at: week ? end : null,
        reviewed_at: reviewed ? end : null,
        reviewed_by_id: reviewed ? 'demo-manager' : null,
        rejection_comment: status === 'REJECTED' ? 'Please include the workshop preparation time.' : null
      }
      await insert('timesheets.weekly_timesheet', {
        id,
        organization_id: 'demo-studio',
        user_id: person.id,
        week_starts_on: start.toISOString().slice(0, 10),
        status,
        ...review,
        ...timestamps
      })
      if (week) {
        await insert('timesheets.submission', {
          id,
          weekly_timesheet_id: id,
          organization_id: 'demo-studio',
          user_id: person.id,
          period_starts_on: start.toISOString().slice(0, 10),
          period_ends_on: end.toISOString().slice(0, 10),
          status,
          ...review,
          ...timestamps
        })
        await insert('timesheets.approval_history', {
          id: `${id}-submitted`,
          weekly_timesheet_id: id,
          submission_id: id,
          action: 'SUBMITTED',
          actor_user_id: person.id,
          created_at: end
        })
        if (reviewed) {
          await insert('timesheets.approval_history', {
            id: `${id}-review`,
            weekly_timesheet_id: id,
            submission_id: id,
            action: status,
            actor_user_id: 'demo-manager',
            created_at: end
          })
        }
        if (status === 'APPROVED') {
          await insert('timesheets.client_review', {
            id,
            weekly_timesheet_id: id,
            submission_id: id,
            client_organization_id: 'demo-garden',
            status: week === 3 ? 'PENDING' : 'APPROVED',
            reviewer_user_id: week === 3 ? null : 'demo-client-owner',
            reviewed_at: week === 3 ? null : end,
            ...timestamps
          })
        }
      }
      for (let weekday = 0; weekday < 5; weekday++) {
        const entryDate = new Date(start.getTime() + weekday * 86400000)
        if (entryDate > now) {
          continue
        }
        const garden = weekday % 2 === 0
        await insert('timesheets.time_entry', {
          id: `${id}-${weekday}`,
          organization_id: 'demo-studio',
          weekly_timesheet_id: id,
          submission_id: week ? id : null,
          user_id: person.id,
          project_id: garden ? 'demo-garden' : 'demo-cycle',
          client_organization_id: garden ? 'demo-garden' : 'demo-cycle',
          activity_type_id: 'demo-development',
          entry_date: entryDate.toISOString().slice(0, 10),
          duration_minutes: 240 + weekday * 30,
          note: garden ? 'Build and test the customer workspace' : 'Improve booking availability and checkout',
          billable_snapshot: true,
          hourly_rate_minor_snapshot: 9500,
          currency_snapshot: 'EUR',
          created_at: entryDate,
          updated_at: entryDate
        })
      }
    }
  }
  for (let month = 0; month < 6; month++) {
    for (const clientId of ['demo-garden', 'demo-cycle']) {
      const id = `${clientId}-invoice-${month}`
      const days = month * 30 + 3
      const status = month === 0 ? 'DRAFT' : month === 1 ? 'ISSUED' : 'PAID'
      await insert('invoices.invoice', {
        id,
        organization_id: 'demo-studio',
        client_organization_id: clientId,
        number: `DEMO-${day.slice(0, 4)}-${clientId === 'demo-garden' ? 'G' : 'C'}${6 - month}`,
        status,
        currency: 'EUR',
        issue_date: date(days),
        due_date: date(days - 30),
        subject: 'Monthly design and development',
        sender_name: 'Northstar Studio',
        sender_address: demoInvoiceSender.address,
        sender_registration: demoInvoiceSender.registrationNumber,
        sender_vat_number: demoInvoiceSender.vatNumber,
        sender_iban: demoInvoiceSender.iban,
        sender_bic: demoInvoiceSender.bic,
        recipient_name: clientId === 'demo-garden' ? 'Greenhouse Collective' : 'Canal Cycle Company',
        recipient_address: 'Sample Lane 8, Netherlands',
        recipient_email: `${clientId}@example.test`,
        created_by_id: 'demo-admin',
        issued_at: month ? ago(days) : null,
        created_at: ago(days),
        updated_at: ago(days)
      })
      await insert('invoices.invoice_line', {
        id,
        invoice_id: id,
        position: 0,
        description: 'Design and development services',
        quantity_milli: 32000,
        unit: 'hour',
        unit_price_minor: 9500,
        vat_rate_basis_points: 2100
      })
      await insert('invoices.invoice_history', {
        id,
        invoice_id: id,
        action: 'CREATED',
        actor_user_id: 'demo-admin',
        created_at: ago(days)
      })
      if (status === 'PAID') {
        await insert('invoices.invoice_payment', {
          id,
          invoice_id: id,
          paid_on: date(days - 14),
          amount_minor: 367840,
          reference: 'Sample bank transfer',
          created_by_id: 'demo-admin',
          created_at: ago(days - 14)
        })
      }
      for (let item = 0; item < 3; item++) {
        const titles = ['Update the onboarding screens', 'Add monthly usage export', 'Investigate slow search results']
        await insert('service_requests.service_request', {
          id: `${id}-request-${item}`,
          title: titles[item],
          description:
            'Please help our team improve this workflow. The acceptance criteria and example steps are included for discussion.',
          status: month > 1 ? 'RESOLVED' : item === 0 ? 'OPEN' : 'IN_PROGRESS',
          priority: item === 2 ? 'HIGH' : 'MEDIUM',
          category: 'Development',
          organization_id: 'demo-studio',
          client_organization_id: clientId,
          created_by_id: 'demo-client-owner',
          assigned_to_id: 'demo-member',
          created_at: ago(days + item),
          updated_at: ago(days)
        })
      }
    }
  }
}
