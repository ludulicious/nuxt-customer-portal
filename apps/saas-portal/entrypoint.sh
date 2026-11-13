#!/bin/sh
set -eu
node /app/scripts/portal.mjs doctor
node /app/scripts/portal.mjs db status
node /app/scripts/portal.mjs db migrate
if [ "${NUXT_PORTAL_DEMO_ENABLED:-false}" != "true" ] && { [ -n "${PORTAL_PROVIDER_NAME:-}" ] || [ -n "${PORTAL_PROVIDER_SLUG:-}" ]; }; then
  if [ -z "${PORTAL_PROVIDER_NAME:-}" ] || [ -z "${PORTAL_PROVIDER_SLUG:-}" ]; then echo "PORTAL_PROVIDER_NAME and PORTAL_PROVIDER_SLUG must be configured together."; exit 1; fi
  node /app/scripts/portal.mjs provider bootstrap --organization-name "$PORTAL_PROVIDER_NAME" --organization-slug "$PORTAL_PROVIDER_SLUG"
fi
node /app/scripts/portal.mjs db status
exec "$@"
