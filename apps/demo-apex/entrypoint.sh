#!/bin/sh
set -eu

echo "Checking portal configuration..."
npx --no-install nuxt-customer-portal doctor

echo "Migration status before startup..."
npx --no-install nuxt-customer-portal db status

echo "Applying portal migrations..."
npx --no-install nuxt-customer-portal db migrate

echo "Migration status after startup..."
npx --no-install nuxt-customer-portal db status

echo "Starting Nuxt server..."
exec "$@"
