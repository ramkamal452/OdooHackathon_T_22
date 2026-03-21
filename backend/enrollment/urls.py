from django.urls import path

from .views import (
    AdminEnrollmentListView,
    AdminLessonProgressListView,
    CourseEnrollmentListView,
    CourseEnrollView,
    CourseInviteView,
    InviteAcceptView,
    InstructorDashboardView,
    LearnerDashboardView,
    MyEnrollmentsView,
)

urlpatterns = [
    path('invite/accept/', InviteAcceptView.as_view(), name='invite-accept'),
    path('courses/<int:pk>/enroll/', CourseEnrollView.as_view(), name='course-enroll'),
    path('courses/<int:pk>/invite/', CourseInviteView.as_view(), name='course-invite'),
    path('courses/<int:pk>/enrollments/', CourseEnrollmentListView.as_view(), name='course-enrollments'),
    path('dashboard/instructor/', InstructorDashboardView.as_view(), name='dashboard-instructor'),
    path('dashboard/learner/', LearnerDashboardView.as_view(), name='dashboard-learner'),
    path('enrollments/my/', MyEnrollmentsView.as_view(), name='enrollments-my'),
    path('admin/enrollments/', AdminEnrollmentListView.as_view(), name='admin-enrollments'),
    path('admin/lesson-progress/', AdminLessonProgressListView.as_view(), name='admin-lesson-progress'),
]
