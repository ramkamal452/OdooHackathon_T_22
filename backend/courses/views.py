from django.db.models import Count, Prefetch, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin, IsInstructorOrAdmin, IsLearner
from quizzes.models import QuizAttempt

from .models import (
    Category,
    Course,
    Enrollment,
    Lesson,
    LessonProgress,
    Module,
    can_access_lesson,
    can_manage_course,
    can_view_course,
    learner_enrolled,
)
from .serializers import (
    AdminCategoryListSerializer,
    AdminCourseListSerializer,
    AdminEnrollmentListSerializer,
    AdminLessonListSerializer,
    AdminLessonProgressListSerializer,
    AdminModuleListSerializer,
    CategoryDetailSerializer,
    CategorySerializer,
    CourseDetailSerializer,
    CourseListSerializer,
    CourseWriteSerializer,
    EnrollmentSerializer,
    LessonSerializer,
    ModuleDetailSerializer,
    ModuleSerializer,
    MyEnrollmentSerializer,
)


def _course_queryset_for_user(user):
    role = getattr(user, 'role', None)
    qs = (
        Course.objects.select_related('instructor', 'category')
        .annotate(
            lesson_count=Count('modules__lessons', distinct=True),
            enrollment_count=Count('enrollments', distinct=True),
        )
    )
    if role == 'admin':
        return qs
    if role == 'instructor':
        return qs.filter(Q(instructor=user) | Q(status='published'))
    return qs.filter(status='published')


def _course_queryset_for_user_with_detail(user):
    lesson_qs = Lesson.objects.order_by('sort_order', 'id')
    module_qs = Module.objects.prefetch_related(
        Prefetch('lessons', queryset=lesson_qs),
    ).order_by('sort_order', 'id')
    return _course_queryset_for_user(user).prefetch_related(
        Prefetch('modules', queryset=module_qs),
    )


class CategoryListCreateView(generics.ListCreateAPIView):
    pagination_class = None
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        perms = super().get_permissions()
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsInstructorOrAdmin()]
        return perms

    def get_serializer_class(self):
        return CategorySerializer

    def get_queryset(self):
        return Category.objects.annotate(course_count=Count('courses', distinct=True)).order_by('name')

    def perform_create(self, serializer):
        serializer.save()


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return CategoryDetailSerializer
        return CategorySerializer

    def get_queryset(self):
        return Category.objects.annotate(course_count=Count('courses', distinct=True))


class CourseListCreateView(generics.ListCreateAPIView):
    pagination_class = None
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CourseWriteSerializer
        return CourseListSerializer

    def get_queryset(self):
        qs = _course_queryset_for_user(self.request.user)
        search = self.request.query_params.get('search')
        category = self.request.query_params.get('category')
        level = self.request.query_params.get('level')
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(short_description__icontains=search))
        if category:
            qs = qs.filter(category_id=category)
        if level:
            qs = qs.filter(level=level)
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        role = getattr(self.request.user, 'role', None)
        if role not in ('admin', 'instructor'):
            raise PermissionDenied('Only instructors and admins can create courses.')
        serializer.save(instructor=self.request.user)


class CourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return CourseWriteSerializer
        return CourseDetailSerializer

    def get_queryset(self):
        if self.request.method == 'GET':
            return _course_queryset_for_user_with_detail(self.request.user)
        return _course_queryset_for_user(self.request.user)

    def get_object(self):
        obj = super().get_object()
        if not can_view_course(self.request.user, obj):
            raise NotFound()
        return obj

    def perform_update(self, serializer):
        course = serializer.instance
        if not can_manage_course(self.request.user, course):
            raise PermissionDenied('You do not have permission to update this course.')
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_course(self.request.user, instance):
            raise PermissionDenied('You do not have permission to delete this course.')
        instance.delete()


class CoursePublishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        course = get_object_or_404(Course, pk=pk)
        if not can_manage_course(request.user, course):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        course.status = 'published' if course.status == 'draft' else 'draft'
        course.save(update_fields=['status', 'updated_at'])
        return Response(
            {'id': course.id, 'status': course.status},
            status=status.HTTP_200_OK,
        )


class CourseEnrollView(APIView):
    permission_classes = [IsAuthenticated, IsLearner]

    def post(self, request, pk):
        course = get_object_or_404(Course, pk=pk)
        if course.status != 'published':
            return Response({'detail': 'Course is not available.'}, status=status.HTTP_404_NOT_FOUND)
        if course.access_rule != 'open':
            return Response(
                {'detail': 'Enrollment is not open for this course.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if Enrollment.objects.filter(course=course, learner=request.user).exists():
            return Response({'detail': 'Already enrolled.'}, status=status.HTTP_400_BAD_REQUEST)
        enrollment = Enrollment.objects.create(course=course, learner=request.user)
        return Response(EnrollmentSerializer(enrollment).data, status=status.HTTP_201_CREATED)


class CourseEnrollmentListView(generics.ListAPIView):
    pagination_class = None
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    serializer_class = EnrollmentSerializer

    def get_queryset(self):
        course = get_object_or_404(Course, pk=self.kwargs['pk'])
        if not can_manage_course(self.request.user, course):
            raise PermissionDenied('You do not have permission to view enrollments.')
        return (
            Enrollment.objects.filter(course=course)
            .select_related('course', 'learner')
            .order_by('-enrolled_at')
        )


class ModuleListCreateView(generics.ListCreateAPIView):
    pagination_class = None
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return ModuleSerializer

    def get_queryset(self):
        course = get_object_or_404(Course, pk=self.kwargs['course_id'])
        if not can_view_course(self.request.user, course):
            raise NotFound()
        return (
            Module.objects.filter(course=course)
            .select_related('course')
            .order_by('sort_order', 'id')
        )

    def perform_create(self, serializer):
        course = get_object_or_404(Course, pk=self.kwargs['course_id'])
        if not can_manage_course(self.request.user, course):
            raise PermissionDenied('You do not have permission to add modules.')
        serializer.save(course=course)


class ModuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ModuleDetailSerializer
        return ModuleSerializer

    def get_queryset(self):
        lesson_qs = Lesson.objects.order_by('sort_order', 'id')
        return (
            Module.objects.select_related('course', 'course__instructor')
            .prefetch_related(Prefetch('lessons', queryset=lesson_qs))
        )

    def get_object(self):
        module = super().get_object()
        if not can_view_course(self.request.user, module.course):
            raise NotFound()
        return module

    def perform_update(self, serializer):
        module = serializer.instance
        if not can_manage_course(self.request.user, module.course):
            raise PermissionDenied('You do not have permission to update this module.')
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_course(self.request.user, instance.course):
            raise PermissionDenied('You do not have permission to delete this module.')
        instance.delete()


class LessonListCreateView(generics.ListCreateAPIView):
    pagination_class = None
    permission_classes = [IsAuthenticated]
    serializer_class = LessonSerializer

    def get_queryset(self):
        module = get_object_or_404(
            Module.objects.select_related('course'),
            pk=self.kwargs['module_id'],
        )
        if not can_view_course(self.request.user, module.course):
            raise NotFound()
        return Lesson.objects.filter(module=module).select_related('module', 'module__course').order_by(
            'sort_order', 'id'
        )

    def perform_create(self, serializer):
        module = get_object_or_404(Module.objects.select_related('course'), pk=self.kwargs['module_id'])
        if not can_manage_course(self.request.user, module.course):
            raise PermissionDenied('You do not have permission to add lessons.')
        serializer.save(module=module)


class LessonDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LessonSerializer
    queryset = Lesson.objects.select_related('module', 'module__course', 'module__course__instructor')

    def get_object(self):
        lesson = super().get_object()
        if not can_access_lesson(self.request.user, lesson):
            raise PermissionDenied('You do not have access to this lesson.')
        return lesson

    def perform_update(self, serializer):
        lesson = serializer.instance
        if not can_manage_course(self.request.user, lesson.module.course):
            raise PermissionDenied('You do not have permission to update this lesson.')
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_course(self.request.user, instance.module.course):
            raise PermissionDenied('You do not have permission to delete this lesson.')
        instance.delete()


class LessonCompleteView(APIView):
    permission_classes = [IsAuthenticated, IsLearner]

    def post(self, request, pk):
        lesson = get_object_or_404(
            Lesson.objects.select_related('module', 'module__course'),
            pk=pk,
        )
        course = lesson.module.course
        if not learner_enrolled(request.user, course):
            return Response({'detail': 'Not enrolled in this course.'}, status=status.HTTP_403_FORBIDDEN)
        enrollment = get_object_or_404(Enrollment, course=course, learner=request.user)
        now = timezone.now()
        progress, created = LessonProgress.objects.get_or_create(
            learner=request.user,
            lesson=lesson,
            defaults={
                'is_completed': True,
                'completed_at': now,
                'last_viewed_at': now,
            },
        )
        if not created:
            progress.is_completed = True
            progress.completed_at = now
            progress.last_viewed_at = now
            progress.save(update_fields=['is_completed', 'completed_at', 'last_viewed_at'])
        enrollment.recalculate_progress()
        enrollment.refresh_from_db()
        return Response(
            {
                'lesson_id': lesson.id,
                'completed': True,
                'progress_percent': enrollment.progress_percent,
            },
            status=status.HTTP_200_OK,
        )


class InstructorDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request):
        user = request.user
        role = getattr(user, 'role', None)
        if role == 'admin':
            courses = Course.objects.all()
        else:
            courses = Course.objects.filter(instructor=user)
        course_ids = list(courses.values_list('id', flat=True))
        enrollments = Enrollment.objects.filter(course_id__in=course_ids)
        total_courses = courses.count()
        total_enrollments = enrollments.count()
        total_completed = enrollments.filter(status='completed').count()
        total_in_progress = enrollments.filter(status='active').count()
        course_rows = []
        for c in courses.annotate(
            enrollment_count=Count('enrollments', distinct=True),
            completion_count=Count('enrollments', filter=Q(enrollments__status='completed'), distinct=True),
        ):
            course_rows.append(
                {
                    'id': c.id,
                    'title': c.title,
                    'status': c.status,
                    'enrollment_count': c.enrollment_count,
                    'completion_count': c.completion_count,
                }
            )
        return Response(
            {
                'total_courses': total_courses,
                'total_enrollments': total_enrollments,
                'total_completed': total_completed,
                'total_in_progress': total_in_progress,
                'courses': course_rows,
            }
        )


class LearnerDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsLearner]

    def get(self, request):
        enrollments = Enrollment.objects.filter(learner=request.user).select_related('course')
        enrolled_courses = enrollments.count()
        in_progress = enrollments.filter(status='active').count()
        completed = enrollments.filter(status='completed').count()
        total_points = (
            QuizAttempt.objects.filter(learner=request.user).aggregate(total=Sum('score'))['total'] or 0
        )
        enrollment_data = []
        for e in enrollments:
            enrollment_data.append(
                {
                    'course_id': e.course_id,
                    'course_title': e.course.title,
                    'status': e.status,
                    'progress_percent': e.progress_percent,
                }
            )
        return Response(
            {
                'enrolled_courses': enrolled_courses,
                'in_progress': in_progress,
                'completed': completed,
                'total_points': int(total_points),
                'enrollments': enrollment_data,
            }
        )


class MyEnrollmentsView(generics.ListAPIView):
    pagination_class = None
    permission_classes = [IsAuthenticated, IsLearner]
    serializer_class = MyEnrollmentSerializer

    def get_queryset(self):
        return Enrollment.objects.filter(learner=self.request.user).select_related('course')


def _optional_bool_param(raw):
    if raw is None or raw == '':
        return None
    s = str(raw).lower()
    if s in ('1', 'true', 'yes', 'on'):
        return True
    if s in ('0', 'false', 'no', 'off'):
        return False
    return None


class AdminCategoryListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    serializer_class = AdminCategoryListSerializer

    def get_queryset(self):
        qs = Category.objects.annotate(course_count=Count('courses', distinct=True)).order_by('name')
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search)
        return qs


class AdminCourseListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    serializer_class = AdminCourseListSerializer

    def get_queryset(self):
        qs = (
            Course.objects.select_related('instructor', 'category')
            .annotate(lesson_count=Count('modules__lessons', distinct=True))
            .order_by('-created_at')
        )
        search = self.request.query_params.get('search')
        status_param = self.request.query_params.get('status')
        category = self.request.query_params.get('category')
        level = self.request.query_params.get('level')
        if search:
            qs = qs.filter(title__icontains=search)
        if status_param:
            qs = qs.filter(status=status_param)
        if category:
            qs = qs.filter(category_id=category)
        if level:
            qs = qs.filter(level=level)
        return qs


class AdminModuleListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    serializer_class = AdminModuleListSerializer

    def get_queryset(self):
        qs = (
            Module.objects.select_related('course')
            .annotate(lesson_count=Count('lessons', distinct=True))
            .order_by('course_id', 'sort_order', 'id')
        )
        search = self.request.query_params.get('search')
        course_id = self.request.query_params.get('course')
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(course__title__icontains=search))
        if course_id:
            qs = qs.filter(course_id=course_id)
        return qs


class AdminLessonListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    serializer_class = AdminLessonListSerializer

    def get_queryset(self):
        qs = Lesson.objects.select_related('module', 'module__course').order_by(
            'module__course_id', 'module_id', 'sort_order', 'id'
        )
        search = self.request.query_params.get('search')
        course_id = self.request.query_params.get('course')
        module_id = self.request.query_params.get('module')
        content_type = self.request.query_params.get('content_type')
        if search:
            qs = qs.filter(title__icontains=search)
        if course_id:
            qs = qs.filter(module__course_id=course_id)
        if module_id:
            qs = qs.filter(module_id=module_id)
        if content_type:
            qs = qs.filter(content_type=content_type)
        return qs


class AdminEnrollmentListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    serializer_class = AdminEnrollmentListSerializer

    def get_queryset(self):
        qs = Enrollment.objects.select_related('learner', 'course').order_by('-enrolled_at')
        search = self.request.query_params.get('search')
        status_param = self.request.query_params.get('status')
        course_id = self.request.query_params.get('course')
        if search:
            qs = qs.filter(
                Q(learner__email__icontains=search) | Q(course__title__icontains=search)
            )
        if status_param:
            qs = qs.filter(status=status_param)
        if course_id:
            qs = qs.filter(course_id=course_id)
        return qs


class AdminLessonProgressListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    serializer_class = AdminLessonProgressListSerializer

    def get_queryset(self):
        qs = LessonProgress.objects.select_related(
            'learner',
            'lesson',
            'lesson__module',
            'lesson__module__course',
        ).order_by('-last_viewed_at', '-id')
        search = self.request.query_params.get('search')
        is_completed_raw = self.request.query_params.get('is_completed')
        is_completed = _optional_bool_param(is_completed_raw)
        if search:
            qs = qs.filter(
                Q(learner__email__icontains=search) | Q(lesson__title__icontains=search)
            )
        if is_completed is not None:
            qs = qs.filter(is_completed=is_completed)
        return qs
