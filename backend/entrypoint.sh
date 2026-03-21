#!/bin/sh
set -e

echo "Running migrations..."
python manage.py makemigrations accounts assets taxonomy content enrollment quizzes gamification reviews
python manage.py migrate

echo "Seeding badges..."
python manage.py seed_badges

echo "Ensuring admin user..."
python manage.py ensure_admin

echo "Starting server..."
python manage.py runserver 0.0.0.0:8000
