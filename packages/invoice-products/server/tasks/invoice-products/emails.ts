import { processInvoiceEmailJobs } from '../../plugins/purchases'

export default defineTask({
  meta: {
    name: 'invoice-products:emails',
    description: 'Deliver queued automated invoice emails'
  },
  async run() {
    return { result: await processInvoiceEmailJobs() }
  }
})
