from django.contrib import admin
from .models import QuizQuestion, QuizOption, QuizAttempt, QuizAttemptAnswer, QuizRewardRule

admin.site.register(QuizQuestion)
admin.site.register(QuizOption)
admin.site.register(QuizAttempt)
admin.site.register(QuizAttemptAnswer)
admin.site.register(QuizRewardRule)
