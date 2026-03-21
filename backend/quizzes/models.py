from django.conf import settings
from django.db import models


class QuestionType(models.IntegerChoices):
    MCQ_SINGLE = 1, 'MCQ Single'
    MCQ_MULTIPLE = 2, 'MCQ Multiple'
    SHORT_TEXT = 3, 'Short text'
    TRUE_FALSE = 4, 'True / False'


class QuizQuestion(models.Model):
    quiz_entity = models.ForeignKey(
        'content.ContentEntity',
        on_delete=models.CASCADE,
        related_name='quiz_questions',
    )
    question_type = models.PositiveSmallIntegerField(
        choices=QuestionType.choices,
        default=QuestionType.MCQ_SINGLE,
    )
    question_text = models.TextField()
    explanation_text = models.TextField(blank=True)
    marks = models.PositiveIntegerField(default=1)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.question_text[:60]


class QuizOption(models.Model):
    question = models.ForeignKey(
        QuizQuestion,
        on_delete=models.CASCADE,
        related_name='options',
    )
    option_text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.option_text[:60]


class QuizAttempt(models.Model):
    quiz_entity = models.ForeignKey(
        'content.ContentEntity',
        on_delete=models.CASCADE,
        related_name='quiz_attempts',
    )
    learner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='quiz_attempts',
    )
    attempt_no = models.PositiveIntegerField(default=1)
    score = models.PositiveIntegerField(default=0)
    max_score = models.PositiveIntegerField(default=0)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_passed = models.BooleanField(default=False)
    time_spent_seconds = models.PositiveIntegerField(null=True, blank=True)
    points_earned = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['quiz_entity', 'learner']),
        ]
        ordering = ['-started_at']

    def __str__(self):
        return f'{self.learner} attempt #{self.attempt_no} on entity {self.quiz_entity_id}'


class QuizAttemptAnswer(models.Model):
    attempt = models.ForeignKey(
        QuizAttempt,
        on_delete=models.CASCADE,
        related_name='answers',
    )
    question = models.ForeignKey(
        QuizQuestion,
        on_delete=models.CASCADE,
    )
    selected_option = models.ForeignKey(
        QuizOption,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    text_answer = models.TextField(blank=True)
    is_correct = models.BooleanField(default=False)
    marks_awarded = models.PositiveIntegerField(default=0)
    answered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['attempt', 'question'],
                name='unique_attempt_question_answer',
            ),
        ]

    def __str__(self):
        return f'Attempt {self.attempt_id} Q{self.question_id}'


class QuizRewardRule(models.Model):
    quiz_entity = models.ForeignKey(
        'content.ContentEntity',
        on_delete=models.CASCADE,
        related_name='reward_rules',
    )
    attempt_from = models.PositiveIntegerField()
    attempt_to = models.PositiveIntegerField(null=True, blank=True)
    points_awarded = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['attempt_from']

    def __str__(self):
        to_str = self.attempt_to or '∞'
        return f'Attempts {self.attempt_from}-{to_str}: {self.points_awarded} pts'
