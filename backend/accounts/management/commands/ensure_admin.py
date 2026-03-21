import os

from django.core.management.base import BaseCommand

from accounts.models import User


class Command(BaseCommand):
    help = 'Ensure at least one admin user exists. Reads credentials from env vars only.'

    def handle(self, *args, **options):
        if User.objects.filter(role='admin').exists():
            self.stdout.write(self.style.SUCCESS('Admin user already exists — skipping.'))
            return

        email = os.environ.get('DJANGO_SUPERUSER_EMAIL')
        password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')

        if not email or not password:
            self.stderr.write(self.style.ERROR(
                'No admin found and DJANGO_SUPERUSER_EMAIL / DJANGO_SUPERUSER_PASSWORD '
                'env vars are not set. Cannot create admin.'
            ))
            return

        User.objects.create_superuser(
            email=email,
            password=password,
            first_name='Admin',
            last_name='User',
            role='admin',
        )
        self.stdout.write(self.style.SUCCESS(f'Admin user {email} created successfully.'))
