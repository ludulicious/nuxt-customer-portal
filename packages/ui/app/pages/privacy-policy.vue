<script setup lang="ts">
definePageMeta({ public: true, layout: 'portal' })

useSeoMeta({
  title: 'Privacy Policy',
  description: 'How we handle information for the Customer Portal project, documentation, and hosted demos.'
})

const sections = [
  {
    title: 'Information We Collect',
    items: [
      'Information you provide: If you contact us through repository issues or email, we may receive your name, email address, and any information you include in your message.',
      'Usage data: If you use a hosted demo, we may collect basic technical data such as IP address, browser type, device information, and usage events to operate and improve the demo.',
      'Cookies: Hosted demos may use cookies or similar technologies for session management and preferences.'
    ]
  },
  {
    title: 'How We Use Information',
    items: [
      'Operate and maintain the Project and hosted demos',
      'Respond to questions and support requests',
      'Improve performance, security, and user experience',
      'Comply with legal obligations'
    ]
  },
  {
    title: 'Self-hosted use',
    paragraphs: ['If you operate a self-hosted instance, you control its data collection and are responsible for your own privacy practices. The Project is open source under the MIT License; licensing does not transfer responsibility for a host’s privacy obligations.']
  },
  { title: 'Sharing of Information', paragraphs: ['We do not sell your personal information. We may share information with service providers that help us host or operate a demo, or if required by law.'] },
  { title: 'Data Retention', paragraphs: ['We retain information only as long as necessary for the purposes described in this policy, unless a longer retention period is required by law.'] },
  { title: 'Security', paragraphs: ['We take reasonable steps to protect information, but no method of transmission or storage is completely secure.'] },
  { title: 'Third-Party Services', paragraphs: ['Hosted demos may rely on third-party services, such as hosting or analytics providers. Their privacy practices are governed by their own policies.'] },
  { title: 'Children’s Privacy', paragraphs: ['The Project is not intended for children under 13, and we do not knowingly collect personal information from children.'] },
  { title: 'Changes to This Policy', paragraphs: ['We may update this policy from time to time. Changes will be posted on this page with a new effective date.'] },
  { title: 'Contact Us', paragraphs: ['If you have questions about this policy, please open a documentation issue in the project repository.'] }
]
</script>

<template>
  <LegalPage
    title="Privacy Policy"
    description="How we handle information for the Customer Portal project, documentation, and hosted demos."
    :children="sections"
  />
</template>
