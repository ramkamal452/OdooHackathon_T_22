#!/bin/sh
set -e

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput 2>/dev/null || true

echo "Seeding badges..."
python manage.py seed_badges

echo "Ensuring admin user..."
python manage.py ensure_admin

WORKERS=${GUNICORN_WORKERS:-3}

echo "Starting gunicorn with $WORKERS workers..."
exec gunicorn learnova.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "$WORKERS" \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
