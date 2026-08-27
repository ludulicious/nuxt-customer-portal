import { defineContentConfig, defineCollection, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    landing: defineCollection({
      type: 'data',
      source: 'index.yml',
      schema: z.object({
        seo: z.object({
          title: z.string(),
          description: z.string(),
          headline: z.string()
        }),
        hero: z.object({
          kicker: z.string(),
          title: z.string(),
          description: z.string(),
          actions: z.array(
            z.object({
              label: z.string(),
              to: z.string(),
              icon: z.string().optional(),
              trailingIcon: z.string().optional(),
              external: z.boolean().default(false),
              variant: z.enum(['solid', 'outline', 'ghost']).default('solid'),
              testId: z.string().optional()
            })
          ),
          license: z.object({
            text: z.string(),
            linkLabel: z.string(),
            linkTo: z.string()
          })
        }),
        extensionModel: z.object({
          title: z.string(),
          badge: z.string(),
          items: z.array(z.object({ title: z.string(), description: z.string() }))
        }),
        hostedEvaluation: z.object({
          kicker: z.string(),
          title: z.string(),
          description: z.string(),
          action: z.object({ label: z.string(), to: z.string() })
        }),
        workflow: z.object({
          title: z.string(),
          description: z.string(),
          stages: z.array(
            z.object({ number: z.string(), title: z.string(), description: z.string(), to: z.string() })
          )
        }),
        platform: z.object({
          title: z.string(),
          description: z.string(),
          ownership: z.array(z.object({ term: z.string(), description: z.string() })),
          links: z.array(z.object({ label: z.string(), to: z.string() }))
        }),
        contributors: z.object({
          title: z.string(),
          description: z.string(),
          link: z.object({ label: z.string(), to: z.string() }),
          paths: z.array(
            z.object({ number: z.string(), title: z.string(), description: z.string(), to: z.string() })
          )
        }),
        technology: z.object({
          title: z.string(),
          description: z.string(),
          items: z.array(
            z.object({ label: z.string(), description: z.string(), icon: z.string(), href: z.string() })
          )
        })
      })
    }),
    docs: defineCollection({
      type: 'page',
      source: {
        include: '**',
        exclude: ['index.yml']
      },
      schema: z.object({
        rawbody: z.string(),
        githubPath: z.string().optional(),
        links: z
          .array(
            z.object({
              label: z.string(),
              icon: z.string(),
              to: z.string(),
              target: z.string().optional()
            })
          )
          .optional()
      })
    })
  }
})
