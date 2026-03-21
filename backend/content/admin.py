from django.contrib import admin

from .models import (
    ArticleContent,
    CompletionRule,
    ContentAttachment,
    ContentEntity,
    ContentStructure,
    CourseSettings,
    EntityPrerequisite,
    EntityStats,
    LessonContent,
    QuizContent,
    ResourceContent,
    VideoContent,
)

admin.site.register(ContentEntity)
admin.site.register(ContentStructure)
admin.site.register(CourseSettings)
admin.site.register(VideoContent)
admin.site.register(ArticleContent)
admin.site.register(ResourceContent)
admin.site.register(LessonContent)
admin.site.register(QuizContent)
admin.site.register(EntityStats)
admin.site.register(CompletionRule)
admin.site.register(EntityPrerequisite)
admin.site.register(ContentAttachment)
