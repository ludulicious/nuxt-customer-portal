import { generateRecurringInvoices } from '../../utils/recurring-invoices'

export default defineTask({
  meta: { name: 'invoices:recurring', description: 'Create due recurring invoices as drafts' },
  async run() {
    return { result: await generateRecurringInvoices() }
  }
})
