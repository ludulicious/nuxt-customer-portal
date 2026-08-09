#!/bin/sh
set -e

# Run package and host migrations
echo "Running Drizzle migrations..."
if ! npx nuxt-customer-portal db migrate; then
  echo "Migration failed!"
  exit 1
fi
# Execute the command passed as arguments to this script (which is the CMD from Dockerfile)
echo "Starting Nuxt server..."
exec "$@"
