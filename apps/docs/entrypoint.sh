#!/bin/sh
set -e

# Execute the command passed as arguments to this script (which is the CMD from Dockerfile)
echo "Starting Nuxt server..."
exec "$@"
