from django.contrib import admin

from .models import Quiz, QuizAnswer, QuizAttempt, QuizOption, QuizQuestion


class QuizOptionInline(admin.TabularInline):
    model = QuizOption
    extra = 0


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ['title', 'course', 'module', 'pass_percentage', 'is_published', 'created_at']
    list_filter = ['is_published', 'created_at']
    search_fields = ['title', 'description', 'course__title']
    raw_id_fields = ['course', 'module']


@admin.register(QuizQuestion)
class QuizQuestionAdmin(admin.ModelAdmin):
    list_display = ['question_text', 'quiz', 'question_type', 'marks', 'sort_order', 'created_at']
    list_filter = ['question_type', 'quiz', 'created_at']
    search_fields = ['question_text']
    raw_id_fields = ['quiz']
    inlines = [QuizOptionInline]


@admin.register(QuizOption)
class QuizOptionAdmin(admin.ModelAdmin):
    list_display = ['option_text', 'question', 'is_correct', 'sort_order']
    list_filter = ['is_correct']
    search_fields = ['option_text']
    raw_id_fields = ['question']


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display = ['quiz', 'learner', 'score', 'total_marks', 'percentage', 'is_passed', 'submitted_at']
    list_filter = ['is_passed', 'submitted_at', 'started_at']
    search_fields = ['quiz__title', 'learner__email']
    raw_id_fields = ['quiz', 'learner']


@admin.register(QuizAnswer)
class QuizAnswerAdmin(admin.ModelAdmin):
    list_display = ['attempt', 'question', 'selected_option', 'is_correct', 'marks_awarded']
    list_filter = ['is_correct']
    raw_id_fields = ['attempt', 'question', 'selected_option']
