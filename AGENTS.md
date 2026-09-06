# Git workflow

Do not edit, commit, or push directly on `master`. Before making changes, inspect the working tree and create or switch to a task branch. Preserve existing work; use a separate worktree when another task owns the current checkout.

Track changes with GitHub issues and integrate them through pull requests targeting `master`. Use a focused branch such as `codex/<issue-number>-<short-description>` when the issue number is known. Link the issue in the pull request, describe the resulting behavior, and report the checks actually run. Include documentation and a changeset when the change needs them.

# Local development

Always use `localhost` as the hostname when opening, checking, or sharing local portal URLs. Do not substitute `127.0.0.1` or another hostname: Better Auth requires the URL to match its configured hostname. This also applies when the development server prints a `127.0.0.1` URL; retain the port and path but use `localhost`.

# Forms

When creating or editing forms in this project, use Nuxt UI's `UForm` and Nuxt UI form components with a Zod validation schema. Display validation errors through Nuxt UI. Disable browser-native form validation with `novalidate`; do not rely on native constraint validation or browser validation popups.
