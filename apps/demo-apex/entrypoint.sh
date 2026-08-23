#!/bin/sh
set -eu

echo "Checking portal configuration..."
npx --no-install nuxt-customer-portal doctor

echo "Migration status before startup..."
npx --no-install nuxt-customer-portal db status

echo "Applying portal migrations..."
npx --no-install nuxt-customer-portal db migrate

if [ -n "${PORTAL_PROVIDER_NAME:-}" ] || [ -n "${PORTAL_PROVIDER_SLUG:-}" ]; then
  if [ -z "${PORTAL_PROVIDER_NAME:-}" ] || [ -z "${PORTAL_PROVIDER_SLUG:-}" ]; then
    echo "PORTAL_PROVIDER_NAME and PORTAL_PROVIDER_SLUG must be configured together."
    exit 1
  fi
  echo "Bootstrapping portal installation..."
  npx --no-install nuxt-customer-portal provider bootstrap \
    --organization-name "$PORTAL_PROVIDER_NAME" \
    --organization-slug "$PORTAL_PROVIDER_SLUG"
fi

echo "Migration status after startup..."
npx --no-install nuxt-customer-portal db status

if [ -n "${PORTAL_CLIENT_MIGRATION_PROVIDER:-}" ]; then
  if [ "${PORTAL_CLIENT_MIGRATION_BACKUP_CONFIRMED:-}" != "true" ]; then
    echo "PORTAL_CLIENT_MIGRATION_PROVIDER is set, but PORTAL_CLIENT_MIGRATION_BACKUP_CONFIRMED is not true."
    exit 1
  fi
  echo "Applying one-time generic clients migration..."
  npx --no-install nuxt-customer-portal clients migrate \
    --provider "$PORTAL_CLIENT_MIGRATION_PROVIDER" \
    --apply --backup-confirmed --once
fi

echo "Starting Nuxt server..."
exec "$@"
