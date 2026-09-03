# Local development

Always use `localhost` as the hostname when opening, checking, or sharing local portal URLs. Do not substitute `127.0.0.1` or another hostname: Better Auth requires the URL to match its configured hostname. This also applies when the development server prints a `127.0.0.1` URL; retain the port and path but use `localhost`.

# Forms

When creating or editing forms in this project, use Nuxt UI's `UForm` and Nuxt UI form components with a Zod validation schema. Display validation errors through Nuxt UI. Disable browser-native form validation with `novalidate`; do not rely on native constraint validation or browser validation popups.
