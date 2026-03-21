from django.contrib import admin

from .models import Category, Course, Enrollment, Lesson, LessonProgress, Module


class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 0


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = [
        'title',
        'slug',
        'instructor',
        'category',
        'level',
        'status',
        'visibility',
        'access_rule',
        'created_at',
    ]
    list_filter = ['status', 'level', 'visibility', 'access_rule', 'created_at']
    search_fields = ['title', 'slug', 'short_description', 'description']
    raw_id_fields = ['instructor', 'category']


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ['title', 'course', 'sort_order', 'created_at']
    list_filter = ['created_at']
    search_fields = ['title', 'description', 'course__title']
    raw_id_fields = ['course']
    inlines = [LessonInline]


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ['title', 'module', 'content_type', 'sort_order', 'is_preview', 'created_at']
    list_filter = ['content_type', 'is_preview', 'created_at']
    search_fields = ['title', 'content_body']
    raw_id_fields = ['module']


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ['course', 'learner', 'status', 'progress_percent', 'enrolled_at', 'completed_at']
    list_filter = ['status', 'enrolled_at']
    search_fields = ['course__title', 'learner__email']
    raw_id_fields = ['course', 'learner']


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display = ['learner', 'lesson', 'is_completed', 'completed_at', 'last_viewed_at']
    list_filter = ['is_completed', 'completed_at']
    search_fields = ['learner__email', 'lesson__title']
    raw_id_fields = ['learner', 'lesson']
