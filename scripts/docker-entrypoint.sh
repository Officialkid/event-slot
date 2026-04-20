#!/bin/sh
set -e

if [ "$RUN_DB_MIGRATIONS" = "true" ]; then
	echo "Running Prisma migrations..."
	npx prisma@5.22.0 migrate deploy
else
	echo "Skipping Prisma migrations on startup (set RUN_DB_MIGRATIONS=true to enable)."
fi

echo "Starting application..."
exec node server.js
