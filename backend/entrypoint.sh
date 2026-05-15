#!/bin/sh

echo "Running database migrations..."

MAX_RETRIES=10
RETRY=0
until alembic upgrade head; do
    RETRY=$((RETRY + 1))
    if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
        echo "ERROR: Migration failed after $MAX_RETRIES attempts. Exiting."
        exit 1
    fi
    echo "Migration attempt $RETRY failed. Retrying in 5s..."
    sleep 5
done

echo "Starting server..."
exec python -m uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload
