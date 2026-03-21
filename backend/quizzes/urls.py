from django.urls import path

from .views import (
    AdminQuizAnswerListView,
    AdminQuizAttemptListView,
    AdminQuizListView,
    AdminQuizOptionListView,
    AdminQuizQuestionListView,
    QuizAttemptListView,
    QuizAttemptSubmitView,
    QuizDetailView,
    QuizListCreateView,
)

urlpatterns = [
    path('course/<int:course_id>/', QuizListCreateView.as_view(), name='quiz-list-create'),
    path('admin/list/', AdminQuizListView.as_view(), name='admin-quizzes'),
    path('admin/questions/', AdminQuizQuestionListView.as_view(), name='admin-quiz-questions'),
    path('admin/options/', AdminQuizOptionListView.as_view(), name='admin-quiz-options'),
    path('admin/attempts/', AdminQuizAttemptListView.as_view(), name='admin-quiz-attempts'),
    path('admin/answers/', AdminQuizAnswerListView.as_view(), name='admin-quiz-answers'),
    path('<int:pk>/', QuizDetailView.as_view(), name='quiz-detail'),
    path('<int:pk>/attempt/', QuizAttemptSubmitView.as_view(), name='quiz-attempt'),
    path('<int:pk>/attempts/', QuizAttemptListView.as_view(), name='quiz-attempts'),
]
