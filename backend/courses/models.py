from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'categories'
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or 'category'
            slug = base
            n = 1
            qs = Category.objects.exclude(pk=self.pk) if self.pk else Category.objects.all()
            while qs.filter(slug=slug).exists():
                slug = f'{base}-{n}'
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)


class Course(models.Model):
    LEVEL_CHOICES = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
    ]
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
    ]
    VISIBILITY_CHOICES = [
        ('everyone', 'Everyone'),
        ('signed_in', 'Signed In'),
    ]
    ACCESS_RULE_CHOICES = [
        ('open', 'Open'),
        ('invitation', 'On Invitation'),
        ('payment', 'On Payment'),
    ]

    instructor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='courses_created',
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='courses',
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    tags = models.CharField(max_length=255, blank=True)
    website = models.URLField(blank=True)
    short_description = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    thumbnail = models.ImageField(upload_to='courses/thumbnails/', blank=True, null=True)
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default='beginner')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='everyone')
    access_rule = models.CharField(max_length=20, choices=ACCESS_RULE_CHOICES, default='open')
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title) or 'course'
            slug = base
            n = 1
            qs = Course.objects.exclude(pk=self.pk) if self.pk else Course.objects.all()
            while qs.filter(slug=slug).exists():
                slug = f'{base}-{n}'
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)


class Module(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='modules')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.title


class Lesson(models.Model):
    CONTENT_TYPE_CHOICES = [
        ('video', 'Video'),
        ('document', 'Document'),
        ('image', 'Image'),
    ]

    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=255)
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES)
    content_body = models.TextField(blank=True)
    allow_download = models.BooleanField(default=False)
    video_url = models.URLField(blank=True)
    resource_url = models.URLField(blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_preview = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.title


class Enrollment(models.Model):
    STATUS_CHOICES = [
        ('yet_to_start', 'Yet to Start'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]

    learner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='enrollments',
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    enrolled_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='yet_to_start')
    progress_percent = models.PositiveIntegerField(default=0)
    time_spent_seconds = models.PositiveIntegerField(default=0)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [['learner', 'course']]

    def __str__(self):
        return f'{self.learner} — {self.course}'

    def recalculate_progress(self):
        total = Lesson.objects.filter(module__course_id=self.course_id).count()
        completed = LessonProgress.objects.filter(
            learner_id=self.learner_id,
            lesson__module__course_id=self.course_id,
            is_completed=True,
        ).count()
        if total == 0:
            pct = 0
        else:
            pct = min(100, round((completed / total) * 100))
        self.progress_percent = pct
        update_fields = ['progress_percent']
        if pct >= 100 and self.status != 'completed':
            self.status = 'completed'
            self.completed_at = timezone.now()
            update_fields.extend(['status', 'completed_at'])
        elif pct > 0 and self.status == 'yet_to_start':
            self.status = 'in_progress'
            if 'status' not in update_fields: update_fields.append('status')
        self.save(update_fields=update_fields)


class LessonProgress(models.Model):
    learner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='lesson_progress',
    )
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='progress')
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_viewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [['learner', 'lesson']]

    def __str__(self):
        return f'{self.learner} — {self.lesson}'


def can_manage_course(user, course):
    role = getattr(user, 'role', None)
    if role == 'admin':
        return True
    if role == 'instructor' and course.instructor_id == user.id:
        return True
    return False


def can_view_course(user, course):
    if can_manage_course(user, course):
        return True
    if course.status != 'published':
        return False
    if course.visibility == 'signed_in' and not user.is_authenticated:
        return False
    return True


def learner_enrolled(user, course):
    return course.enrollments.filter(learner_id=user.id).exists()


def can_access_lesson(user, lesson):
    course = lesson.module.course
    if can_manage_course(user, course):
        return True
    if getattr(user, 'role', None) == 'learner' and learner_enrolled(user, course):
        return True
    return False


def can_access_course_quizzes(user, course):
    if can_manage_course(user, course):
        return True
    if getattr(user, 'role', None) == 'learner' and learner_enrolled(user, course):
        return True
    return False

class LessonAttachment(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='attachments')
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to='lessons/attachments/', blank=True, null=True)
    url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class CourseReview(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews')
    rating = models.PositiveSmallIntegerField(default=5)
    review_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [['course', 'user']]

    def __str__(self):
        return f'{self.user} - {self.course} ({self.rating} stars)'
