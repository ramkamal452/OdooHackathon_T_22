#!/bin/sh
set -e

echo "Creating migrations..."
python manage.py makemigrations accounts courses quizzes

echo "Applying database migrations..."
python manage.py migrate

echo "Checking for admin user..."
python manage.py ensure_admin

echo "Starting Django server on port 8000..."
exec python manage.py runserver 0.0.0.0:8000
