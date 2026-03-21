from django.core.management.base import BaseCommand

from gamification.models import Badge


BADGE_DEFINITIONS = [
    {'name': 'Newbie', 'slug': 'newbie', 'description': 'Welcome aboard! You earned your first 20 points.', 'min_points': 20, 'sort_order': 1},
    {'name': 'Explorer', 'slug': 'explorer', 'description': 'Curious mind! 40 points earned.', 'min_points': 40, 'sort_order': 2},
    {'name': 'Achiever', 'slug': 'achiever', 'description': 'Great progress! 60 points earned.', 'min_points': 60, 'sort_order': 3},
    {'name': 'Specialist', 'slug': 'specialist', 'description': 'Impressive dedication! 80 points earned.', 'min_points': 80, 'sort_order': 4},
    {'name': 'Expert', 'slug': 'expert', 'description': 'Outstanding performance! 100 points earned.', 'min_points': 100, 'sort_order': 5},
    {'name': 'Master', 'slug': 'master', 'description': 'Top of the class! 120 points earned.', 'min_points': 120, 'sort_order': 6},
]


class Command(BaseCommand):
    help = 'Seed the 6 standard badge definitions from the PDF spec'

    def handle(self, *args, **options):
        created_count = 0
        for defn in BADGE_DEFINITIONS:
            _, created = Badge.objects.get_or_create(
                slug=defn['slug'],
                defaults=defn,
            )
            if created:
                created_count += 1
        self.stdout.write(self.style.SUCCESS(
            f'Badges: {created_count} created, {len(BADGE_DEFINITIONS) - created_count} already existed.'
        ))
