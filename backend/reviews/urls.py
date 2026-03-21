from django.urls import path

from .views import CourseReviewListCreateView

urlpatterns = [
    path('courses/<int:pk>/reviews/', CourseReviewListCreateView.as_view(), name='course-reviews'),
]
