<script setup lang="ts">
definePageMeta({ public: true, layout: 'portal' })

useSeoMeta({
  title: 'Terms of Service',
  description: 'Terms for using the Customer Portal project, documentation, and any hosted demo.'
})

const sections = [
  { title: 'Source-code license', paragraphs: ['Nuxt Customer Portal is provided under the MIT License in the repository root. These hosted-service terms do not replace or restrict the permissions granted by that software license.'] },
  { title: 'Use of Hosted Demos', paragraphs: ['Hosted demos are provided for evaluation purposes and may be changed or discontinued at any time. You agree not to use hosted demos to store sensitive or regulated data.'] },
  {
    title: 'Acceptable Use',
    items: [
      'Use the Project or demos for unlawful or harmful activities',
      'Attempt to disrupt, exploit, or reverse engineer our systems',
      'Interfere with other users or the integrity of the service'
    ]
  },
  { title: 'Accounts and Content', paragraphs: ['If a hosted demo allows account creation, you are responsible for your account activity and any content you submit. You retain ownership of your content, but grant us a limited license to host and process it for providing the service.'] },
  { title: 'Third-Party Services', paragraphs: ['The Project may integrate with third-party services. We are not responsible for third-party services, and their terms and policies apply.'] },
  { title: 'Disclaimer', paragraphs: ['The Project and hosted demos are provided “as is” and “as available” without warranties of any kind, whether express or implied.'] },
  { title: 'Limitation of Liability', paragraphs: ['To the fullest extent permitted by law, we are not liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data, profits, or revenues arising from your use of the Project or demos.'] },
  { title: 'Indemnification', paragraphs: ['You agree to indemnify and hold us harmless from any claims arising out of your use of the Project or hosted demos, or your violation of these Terms.'] },
  { title: 'Termination', paragraphs: ['We may suspend or terminate access to hosted demos at any time for any reason.'] },
  { title: 'Changes to These Terms', paragraphs: ['We may update these Terms from time to time. Changes will be posted on this page with a new effective date.'] },
  { title: 'Contact Us', paragraphs: ['If you have questions about these Terms, please open a documentation issue in the project repository.'] }
]
</script>

<template>
  <LegalPage
    title="Terms of Service"
    description="Terms for using the Customer Portal project, documentation, and any hosted demo."
    :children="sections"
  />
</template>
