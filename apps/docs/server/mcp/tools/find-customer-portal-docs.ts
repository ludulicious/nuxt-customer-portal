import { z } from 'zod'
import { findDocumentation } from '../../utils/documentation-catalog'
import { documentationDefaults } from '../../../shared/documentation'

export default defineMcpTool({
  title: 'Find Customer Portal documentation',
  description:
    'Find source-backed Customer Portal guides about setup, architecture, modules, product workflows, and contributing.',
  tags: ['documentation', 'customer-portal', 'read-only'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  },
  inputSchema: {
    query: z
      .string()
      .default('')
      .describe('Words describing the task or Customer Portal topic. Leave empty to list the documentation.'),
    limit: z.number().int().min(1).max(20).default(8)
  },
  inputExamples: [
    { query: 'create a feature layer', limit: 5 },
    { query: 'invoice approved time', limit: 5 },
    { query: 'tenant authorization', limit: 5 }
  ],
  handler: ({ query, limit }) => ({
    pages: findDocumentation(query, limit),
    completeDocumentation: 'https://nuxt-customer-portal.com/llms-full.txt',
    verifiedProductSource: {
      repository: documentationDefaults.productRepositoryUrl,
      commit: documentationDefaults.productSourceCommit,
      url: `${documentationDefaults.productRepositoryUrl}/commit/${documentationDefaults.productSourceCommit}`
    }
  })
})
