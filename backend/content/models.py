from django.conf import settings
from django.db import models
from django.utils.text import slugify


# ---------------------------------------------------------------------------
# Enum choices
# ---------------------------------------------------------------------------

class EntityType(models.IntegerChoices):
    COURSE = 1, 'Course'
    MODULE = 2, 'Module'
    LESSON = 3, 'Lesson'
    VIDEO = 4, 'Video'
    QUIZ = 5, 'Quiz'
    ARTICLE = 6, 'Article'
    RESOURCE = 7, 'Resource'


class StatusCode(models.IntegerChoices):
    DRAFT = 1, 'Draft'
    PUBLISHED = 2, 'Published'
    ARCHIVED = 3, 'Archived'
    HIDDEN = 4, 'Hidden'


class UnlockRuleCode(models.IntegerChoices):
    IMMEDIATE = 1, 'Immediate'
    AFTER_PREVIOUS = 2, 'After previous'
    AFTER_PREREQUISITE = 3, 'After prerequisite'
    SCHEDULED = 4, 'Scheduled'
    MANUAL = 5, 'Manual'


class VisibilityCode(models.IntegerChoices):
    EVERYONE = 1, 'Everyone'
    SIGNED_IN = 2, 'Signed In'


class AccessRuleCode(models.IntegerChoices):
    OPEN = 1, 'Open'
    INVITATION = 2, 'On Invitation'
    PAYMENT = 3, 'On Payment'


class LevelCode(models.IntegerChoices):
    BEGINNER = 1, 'Beginner'
    INTERMEDIATE = 2, 'Intermediate'
    ADVANCED = 3, 'Advanced'


class StreamingProvider(models.IntegerChoices):
    DIRECT_S3 = 1, 'Direct S3'
    CLOUDFRONT = 2, 'CloudFront'
    HLS = 3, 'HLS / Streaming'


class ResourceKind(models.IntegerChoices):
    PDF = 1, 'PDF'
    IMAGE = 2, 'Image'
    WORKSHEET = 3, 'Worksheet'
    ATTACHMENT = 4, 'Attachment'
    EXTERNAL_LINK = 5, 'External link'


class LessonFormat(models.IntegerChoices):
    TEXT = 1, 'Text'
    MIXED = 2, 'Mixed'
    GUIDED = 3, 'Guided'
    WRAPPER = 4, 'Wrapper'


class CompletionRuleType(models.IntegerChoices):
    ALL_REQUIRED_CHILDREN = 1, 'All required children'
    ANY_N_CHILDREN = 2, 'Any N children'
    PASS_QUIZ = 3, 'Pass quiz'
    WATCH_PERCENTAGE = 4, 'Watch percentage'
    MANUAL_MARK_COMPLETE = 5, 'Manual mark complete'


# ---------------------------------------------------------------------------
# Managers
# ---------------------------------------------------------------------------

class ActiveEntityManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


# ---------------------------------------------------------------------------
# Core content entity
# ---------------------------------------------------------------------------

class ContentEntity(models.Model):
    entity_type = models.PositiveSmallIntegerField(choices=EntityType.choices)
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=280, unique=True, blank=True)
    short_description = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_entities',
    )
    status_code = models.PositiveSmallIntegerField(
        choices=StatusCode.choices,
        default=StatusCode.DRAFT,
    )
    thumbnail_asset = models.ForeignKey(
        'assets.Asset',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    estimated_duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    allow_standalone_enrollment = models.BooleanField(default=False)
    is_reusable = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = ActiveEntityManager()
    all_objects = models.Manager()

    class Meta:
        indexes = [
            models.Index(fields=['entity_type', 'status_code']),
            models.Index(fields=['owner', 'entity_type']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.get_entity_type_display()}] {self.title}'

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title) or 'entity'
            slug = base
            n = 1
            qs = ContentEntity.all_objects.exclude(pk=self.pk) if self.pk else ContentEntity.all_objects.all()
            while qs.filter(slug=slug).exists():
                slug = f'{base}-{n}'
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Structure (parent-child hierarchy)
# ---------------------------------------------------------------------------

class ContentStructure(models.Model):
    parent_entity = models.ForeignKey(
        ContentEntity,
        on_delete=models.CASCADE,
        related_name='children_links',
    )
    child_entity = models.ForeignKey(
        ContentEntity,
        on_delete=models.CASCADE,
        related_name='parent_links',
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_required = models.BooleanField(default=True)
    is_preview = models.BooleanField(default=False)
    unlock_rule_code = models.PositiveSmallIntegerField(
        choices=UnlockRuleCode.choices,
        default=UnlockRuleCode.IMMEDIATE,
    )
    unlock_rule_config = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['parent_entity', 'child_entity']]
        indexes = [
            models.Index(fields=['parent_entity', 'sort_order']),
        ]
        ordering = ['sort_order']

    def __str__(self):
        return f'{self.parent_entity_id} -> {self.child_entity_id} (#{self.sort_order})'


# ---------------------------------------------------------------------------
# Course-specific settings (detail table for entity_type=COURSE)
# ---------------------------------------------------------------------------

class CourseSettings(models.Model):
    entity = models.OneToOneField(
        ContentEntity,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='course_settings',
    )
    visibility_code = models.PositiveSmallIntegerField(
        choices=VisibilityCode.choices,
        default=VisibilityCode.EVERYONE,
    )
    access_rule_code = models.PositiveSmallIntegerField(
        choices=AccessRuleCode.choices,
        default=AccessRuleCode.OPEN,
    )
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    website = models.URLField(max_length=500, blank=True)
    responsible = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='responsible_courses',
    )
    level_code = models.PositiveSmallIntegerField(
        choices=LevelCode.choices,
        null=True,
        blank=True,
    )

    def __str__(self):
        return f'Settings for entity {self.entity_id}'


# ---------------------------------------------------------------------------
# Detail tables per entity type
# ---------------------------------------------------------------------------

class VideoContent(models.Model):
    entity = models.OneToOneField(
        ContentEntity,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='video_detail',
    )
    video_asset = models.ForeignKey(
        'assets.Asset', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
    )
    poster_asset = models.ForeignKey(
        'assets.Asset', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
    )
    captions_asset = models.ForeignKey(
        'assets.Asset', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
    )
    video_url = models.URLField(max_length=500, blank=True)
    streaming_provider = models.PositiveSmallIntegerField(
        choices=StreamingProvider.choices,
        default=StreamingProvider.DIRECT_S3,
    )
    duration_seconds = models.PositiveIntegerField(default=0)
    transcript_text = models.TextField(blank=True)
    allow_download = models.BooleanField(default=False)
    autoplay_enabled = models.BooleanField(default=False)

    def __str__(self):
        return f'Video for entity {self.entity_id}'


class ArticleContent(models.Model):
    entity = models.OneToOneField(
        ContentEntity,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='article_detail',
    )
    body_markdown = models.TextField(blank=True)
    reading_time_seconds = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f'Article for entity {self.entity_id}'


class ResourceContent(models.Model):
    entity = models.OneToOneField(
        ContentEntity,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='resource_detail',
    )
    asset = models.ForeignKey(
        'assets.Asset', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
    )
    resource_url = models.URLField(max_length=500, blank=True)
    resource_kind = models.PositiveSmallIntegerField(
        choices=ResourceKind.choices,
        default=ResourceKind.ATTACHMENT,
    )
    allow_download = models.BooleanField(default=False)

    def __str__(self):
        return f'Resource for entity {self.entity_id}'


class LessonContent(models.Model):
    entity = models.OneToOneField(
        ContentEntity,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='lesson_detail',
    )
    lesson_format = models.PositiveSmallIntegerField(
        choices=LessonFormat.choices,
        default=LessonFormat.TEXT,
    )
    body = models.TextField(blank=True)

    def __str__(self):
        return f'Lesson for entity {self.entity_id}'


class QuizContent(models.Model):
    entity = models.OneToOneField(
        ContentEntity,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='quiz_detail',
    )
    instructions = models.TextField(blank=True)
    attempt_limit = models.PositiveIntegerField(default=0)
    pass_percentage = models.PositiveIntegerField(default=50)
    shuffle_questions = models.BooleanField(default=False)
    shuffle_options = models.BooleanField(default=False)
    show_answers_after_submit = models.BooleanField(default=True)
    show_score_immediately = models.BooleanField(default=True)
    time_limit_seconds = models.PositiveIntegerField(null=True, blank=True)
    allow_resume = models.BooleanField(default=False)
    award_points = models.BooleanField(default=True)

    def __str__(self):
        return f'Quiz config for entity {self.entity_id}'


# ---------------------------------------------------------------------------
# Stats (precomputed, 1:1 with content entity)
# ---------------------------------------------------------------------------

class EntityStats(models.Model):
    entity = models.OneToOneField(
        ContentEntity,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='stats',
    )
    direct_child_count = models.PositiveIntegerField(default=0)
    required_child_count = models.PositiveIntegerField(default=0)
    total_duration_seconds = models.PositiveIntegerField(default=0)
    enrollment_count = models.PositiveIntegerField(default=0)
    completion_count = models.PositiveIntegerField(default=0)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_reviews = models.PositiveIntegerField(default=0)
    total_points_awarded = models.PositiveIntegerField(default=0)
    views_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Stats for entity {self.entity_id}'


# ---------------------------------------------------------------------------
# Completion rules
# ---------------------------------------------------------------------------

class CompletionRule(models.Model):
    entity = models.ForeignKey(
        ContentEntity,
        on_delete=models.CASCADE,
        related_name='completion_rules',
    )
    rule_type = models.PositiveSmallIntegerField(choices=CompletionRuleType.choices)
    rule_config = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.get_rule_type_display()} for entity {self.entity_id}'


# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------

class EntityPrerequisite(models.Model):
    entity = models.ForeignKey(
        ContentEntity,
        on_delete=models.CASCADE,
        related_name='prerequisites',
    )
    required_entity = models.ForeignKey(
        ContentEntity,
        on_delete=models.CASCADE,
        related_name='dependents',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['entity', 'required_entity']]

    def __str__(self):
        return f'{self.entity_id} requires {self.required_entity_id}'


# ---------------------------------------------------------------------------
# Attachments (generic for any entity)
# ---------------------------------------------------------------------------

class ContentAttachment(models.Model):
    entity = models.ForeignKey(
        ContentEntity,
        on_delete=models.CASCADE,
        related_name='attachments',
    )
    title = models.CharField(max_length=255)
    asset = models.ForeignKey(
        'assets.Asset',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    external_url = models.URLField(max_length=500, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order']

    def __str__(self):
        return self.title
