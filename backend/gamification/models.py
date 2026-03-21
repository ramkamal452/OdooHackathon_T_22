from django.conf import settings
from django.db import models


class Badge(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    min_points = models.PositiveIntegerField(default=0)
    icon_asset = models.ForeignKey(
        'assets.Asset',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order', 'min_points']

    def __str__(self):
        return self.name


class UserBadge(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='earned_badges',
    )
    badge = models.ForeignKey(
        Badge,
        on_delete=models.CASCADE,
        related_name='awarded_to',
    )
    awarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['user', 'badge']]

    def __str__(self):
        return f'{self.user} earned {self.badge}'


class SourceType(models.IntegerChoices):
    QUIZ = 1, 'Quiz'
    COURSE_COMPLETION = 2, 'Course completion'
    LESSON_COMPLETION = 3, 'Lesson completion'
    ADMIN_BONUS = 4, 'Admin bonus'
    BADGE_BONUS = 5, 'Badge bonus'


class UserPointLedger(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='point_ledger',
    )
    source_type = models.PositiveSmallIntegerField(choices=SourceType.choices)
    source_entity = models.ForeignKey(
        'content.ContentEntity',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    source_attempt = models.ForeignKey(
        'quizzes.QuizAttempt',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    points = models.IntegerField()
    reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        sign = '+' if self.points >= 0 else ''
        return f'{sign}{self.points} for {self.user}'

    @classmethod
    def award_points(cls, user, points, source_type, reason='',
                     source_entity=None, source_attempt=None):
        entry = cls.objects.create(
            user=user,
            source_type=source_type,
            source_entity=source_entity,
            source_attempt=source_attempt,
            points=points,
            reason=reason,
        )
        user.points = max(0, user.points + points)
        user.save(update_fields=['points'])

        cls._check_and_award_badges(user)
        return entry

    @classmethod
    def _check_and_award_badges(cls, user):
        from gamification.models import Badge, UserBadge
        earned_ids = set(
            UserBadge.objects.filter(user=user).values_list('badge_id', flat=True)
        )
        for badge in Badge.objects.filter(is_active=True).order_by('min_points'):
            if badge.id not in earned_ids and user.points >= badge.min_points:
                UserBadge.objects.create(user=user, badge=badge)
