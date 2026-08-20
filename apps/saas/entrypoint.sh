#!/bin/sh
set -eu

echo "Applying platform authentication and control-plane migrations..."
pnpm platform:migrate

echo "Starting SaaS host..."
exec "$@"
