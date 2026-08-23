#!/bin/sh
set -eu
npx --no-install nuxt-customer-portal doctor
npx --no-install nuxt-customer-portal db status
npx --no-install nuxt-customer-portal db migrate
if [ -n "${PORTAL_PROVIDER_NAME:-}" ] || [ -n "${PORTAL_PROVIDER_SLUG:-}" ]; then
  if [ -z "${PORTAL_PROVIDER_NAME:-}" ] || [ -z "${PORTAL_PROVIDER_SLUG:-}" ]; then echo "PORTAL_PROVIDER_NAME and PORTAL_PROVIDER_SLUG must be configured together."; exit 1; fi
  npx --no-install nuxt-customer-portal provider bootstrap --organization-name "$PORTAL_PROVIDER_NAME" --organization-slug "$PORTAL_PROVIDER_SLUG"
fi
npx --no-install nuxt-customer-portal db status
exec "$@"
