from django.core.management.base import BaseCommand

from accounts.models import User
from content.models import (
    ContentEntity,
    ContentStructure,
    CourseSettings,
    EntityStats,
    EntityType,
    LessonContent,
    QuizContent,
    ResourceContent,
    ResourceKind,
    StatusCode,
    VideoContent,
)
from quizzes.models import QuizOption, QuizQuestion, QuizRewardRule


class Command(BaseCommand):
    help = 'Seed sample course with modules, lessons, quizzes (dev only)'

    def handle(self, *args, **options):
        instructor, _ = User.objects.get_or_create(
            email='instructor@learnova.dev',
            defaults={
                'first_name': 'Demo',
                'last_name': 'Instructor',
                'role': 'instructor',
            },
        )
        if instructor.has_usable_password() is False:
            instructor.set_password('instructor123')
            instructor.save()

        if ContentEntity.objects.filter(slug='intro-to-learnova').exists():
            self.stdout.write(self.style.WARNING('Sample data already exists.'))
            return

        course = ContentEntity.objects.create(
            entity_type=EntityType.COURSE,
            title='Introduction to Learnova',
            slug='intro-to-learnova',
            short_description='A sample course to explore the platform.',
            description='This is a demo course with modules, video lessons, document lessons, and quizzes.',
            owner=instructor,
            status_code=StatusCode.PUBLISHED,
        )
        CourseSettings.objects.create(entity=course, level_code=1, website='https://learnova.dev')
        EntityStats.objects.create(entity=course)

        mod1 = ContentEntity.objects.create(
            entity_type=EntityType.MODULE, title='Getting Started',
            slug='getting-started', owner=instructor, status_code=StatusCode.PUBLISHED,
        )
        ContentStructure.objects.create(parent_entity=course, child_entity=mod1, sort_order=0)

        mod2 = ContentEntity.objects.create(
            entity_type=EntityType.MODULE, title='Advanced Topics',
            slug='advanced-topics', owner=instructor, status_code=StatusCode.PUBLISHED,
        )
        ContentStructure.objects.create(parent_entity=course, child_entity=mod2, sort_order=1)

        v1 = ContentEntity.objects.create(
            entity_type=EntityType.VIDEO, title='Welcome Video',
            slug='welcome-video', owner=instructor, status_code=StatusCode.PUBLISHED,
            estimated_duration_seconds=300,
        )
        VideoContent.objects.create(entity=v1, video_url='https://www.youtube.com/embed/dQw4w9WgXcQ', duration_seconds=300)
        ContentStructure.objects.create(parent_entity=mod1, child_entity=v1, sort_order=0)

        d1 = ContentEntity.objects.create(
            entity_type=EntityType.RESOURCE, title='Platform Guide',
            slug='platform-guide', owner=instructor, status_code=StatusCode.PUBLISHED,
        )
        ResourceContent.objects.create(entity=d1, resource_kind=ResourceKind.PDF, resource_url='https://example.com/guide.pdf')
        ContentStructure.objects.create(parent_entity=mod1, child_entity=d1, sort_order=1)

        l1 = ContentEntity.objects.create(
            entity_type=EntityType.LESSON, title='Architecture Overview',
            slug='architecture-overview', owner=instructor, status_code=StatusCode.PUBLISHED,
        )
        LessonContent.objects.create(entity=l1, body='Learnova uses a polymorphic content model...', lesson_format=1)
        ContentStructure.objects.create(parent_entity=mod2, child_entity=l1, sort_order=0)

        quiz = ContentEntity.objects.create(
            entity_type=EntityType.QUIZ, title='Knowledge Check',
            slug='knowledge-check', owner=instructor, status_code=StatusCode.PUBLISHED,
        )
        QuizContent.objects.create(entity=quiz, pass_percentage=50, attempt_limit=0, award_points=True)
        ContentStructure.objects.create(parent_entity=mod2, child_entity=quiz, sort_order=1)

        QuizRewardRule.objects.bulk_create([
            QuizRewardRule(quiz_entity=quiz, attempt_from=1, attempt_to=1, points_awarded=10),
            QuizRewardRule(quiz_entity=quiz, attempt_from=2, attempt_to=2, points_awarded=8),
            QuizRewardRule(quiz_entity=quiz, attempt_from=3, attempt_to=3, points_awarded=5),
            QuizRewardRule(quiz_entity=quiz, attempt_from=4, attempt_to=None, points_awarded=2),
        ])

        q1 = QuizQuestion.objects.create(
            quiz_entity=quiz, question_text='What is the core content table called?',
            marks=1, sort_order=0,
        )
        QuizOption.objects.create(question=q1, option_text='ContentEntity', is_correct=True, sort_order=0)
        QuizOption.objects.create(question=q1, option_text='Course', is_correct=False, sort_order=1)
        QuizOption.objects.create(question=q1, option_text='Lesson', is_correct=False, sort_order=2)

        q2 = QuizQuestion.objects.create(
            quiz_entity=quiz, question_text='How are parent-child relationships stored?',
            marks=1, sort_order=1,
        )
        QuizOption.objects.create(question=q2, option_text='Foreign key on child', is_correct=False, sort_order=0)
        QuizOption.objects.create(question=q2, option_text='ContentStructure table', is_correct=True, sort_order=1)
        QuizOption.objects.create(question=q2, option_text='JSON field', is_correct=False, sort_order=2)

        self.stdout.write(self.style.SUCCESS(
            f'Created sample course "{course.title}" with {2} modules, {3} lessons, {1} quiz.'
        ))
