from django.urls import path

from .views import (
    AdminCategoryListView,
    AdminCourseListView,
    AdminLessonListView,
    AdminModuleListView,
    CategoryDetailView,
    CategoryListCreateView,
    CourseDetailView,
    CourseListCreateView,
    CoursePublishView,
    LessonCompleteView,
    LessonDetailView,
    LessonListCreateView,
    ModuleDetailView,
    ModuleListCreateView,
)

urlpatterns = [
    path('categories/', CategoryListCreateView.as_view(), name='category-list-create'),
    path('categories/<int:pk>/', CategoryDetailView.as_view(), name='category-detail'),
    path('courses/', CourseListCreateView.as_view(), name='course-list-create'),
    path('courses/<int:pk>/', CourseDetailView.as_view(), name='course-detail'),
    path('courses/<int:pk>/publish/', CoursePublishView.as_view(), name='course-publish'),
    path('courses/<int:course_id>/modules/', ModuleListCreateView.as_view(), name='module-list-create'),
    path('modules/<int:pk>/', ModuleDetailView.as_view(), name='module-detail'),
    path('modules/<int:module_id>/lessons/', LessonListCreateView.as_view(), name='lesson-list-create'),
    path('lessons/<int:pk>/', LessonDetailView.as_view(), name='lesson-detail'),
    path('lessons/<int:pk>/complete/', LessonCompleteView.as_view(), name='lesson-complete'),
    path('admin/categories/', AdminCategoryListView.as_view(), name='admin-categories'),
    path('admin/courses/', AdminCourseListView.as_view(), name='admin-courses'),
    path('admin/modules/', AdminModuleListView.as_view(), name='admin-modules'),
    path('admin/lessons/', AdminLessonListView.as_view(), name='admin-lessons'),
]
