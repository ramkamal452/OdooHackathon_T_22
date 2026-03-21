from django.conf import settings
from django.db import models


class CourseReview(models.Model):
    course_entity = models.ForeignKey(
        'content.ContentEntity',
        on_delete=models.CASCADE,
        related_name='reviews',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews',
    )
    rating = models.PositiveSmallIntegerField(default=5)
    review_text = models.TextField()
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [['course_entity', 'user']]

    def __str__(self):
        return f'{self.user} - entity {self.course_entity_id} ({self.rating} stars)'
