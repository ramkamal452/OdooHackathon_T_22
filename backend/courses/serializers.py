from django.db.models import Count
from rest_framework import serializers

from accounts.serializers import BriefUserSerializer

from .models import Category, Course, Enrollment, Lesson, LessonProgress, Module, LessonAttachment, CourseReview

class LessonAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonAttachment
        fields = ['id', 'title', 'file', 'url', 'created_at']
        read_only_fields = ['id', 'created_at']

class CourseReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_avatar = serializers.SerializerMethodField()

    class Meta:
        model = CourseReview
        fields = ['id', 'course', 'user', 'user_name', 'user_avatar', 'rating', 'review_text', 'created_at']
        read_only_fields = ['id', 'course', 'user', 'user_name', 'user_avatar', 'created_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.email

    def get_user_avatar(self, obj):
        request = self.context.get('request')
        if obj.user.avatar and request:
            return request.build_absolute_uri(obj.user.avatar.url)
        return None


class BriefCourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['id', 'title', 'slug']


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'created_at']
        read_only_fields = ['id', 'slug', 'created_at']


class CategoryDetailSerializer(CategorySerializer):
    course_count = serializers.IntegerField(read_only=True)

    class Meta(CategorySerializer.Meta):
        fields = CategorySerializer.Meta.fields + ['course_count']


class LessonSerializer(serializers.ModelSerializer):
    attachments = LessonAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Lesson
        fields = [
            'id',
            'module',
            'title',
            'content_type',
            'content_body',
            'allow_download',
            'video_url',
            'resource_url',
            'duration_minutes',
            'sort_order',
            'is_preview',
            'created_at',
            'updated_at',
            'attachments',
        ]
        read_only_fields = ['id', 'module', 'created_at', 'updated_at']


class ModuleSerializer(serializers.ModelSerializer):
    course = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Module
        fields = ['id', 'course', 'title', 'description', 'sort_order', 'created_at']
        read_only_fields = ['id', 'course', 'created_at']


class ModuleDetailSerializer(ModuleSerializer):
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta(ModuleSerializer.Meta):
        fields = ModuleSerializer.Meta.fields + ['lessons']


class CourseListSerializer(serializers.ModelSerializer):
    instructor_name = serializers.SerializerMethodField()
    category_name = serializers.SerializerMethodField()
    lesson_count = serializers.SerializerMethodField()
    enrollment_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'id',
            'title',
            'slug',
            'tags',
            'website',
            'short_description',
            'thumbnail',
            'instructor_name',
            'category_name',
            'level',
            'status',
            'lesson_count',
            'enrollment_count',
            'duration_minutes',
            'created_at',
        ]

    def get_instructor_name(self, obj):
        return obj.instructor.get_full_name() or obj.instructor.email

    def get_category_name(self, obj):
        return obj.category.name if obj.category_id else None

    def get_lesson_count(self, obj):
        annotated = getattr(obj, 'lesson_count', None)
        if annotated is not None:
            return annotated
        return Lesson.objects.filter(module__course_id=obj.pk).count()

    def get_enrollment_count(self, obj):
        annotated = getattr(obj, 'enrollment_count', None)
        if annotated is not None:
            return annotated
        return obj.enrollments.count()


class CourseDetailSerializer(serializers.ModelSerializer):
    instructor = BriefUserSerializer(read_only=True)
    category = CategorySerializer(read_only=True, allow_null=True)
    modules = ModuleDetailSerializer(many=True, read_only=True)
    enrollment_status = serializers.SerializerMethodField()
    reviews = CourseReviewSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = [
            'id',
            'title',
            'slug',
            'tags',
            'website',
            'short_description',
            'description',
            'thumbnail',
            'instructor',
            'category',
            'level',
            'status',
            'visibility',
            'access_rule',
            'price',
            'duration_minutes',
            'created_at',
            'updated_at',
            'modules',
            'enrollment_status',
            'reviews',
        ]
        read_only_fields = fields

    def get_enrollment_status(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        user = request.user
        role = getattr(user, 'role', None)
        if role == 'admin' or (role == 'instructor' and obj.instructor_id == user.id):
            return 'owner'
        try:
            enrollment = Enrollment.objects.get(course=obj, learner=user)
        except Enrollment.DoesNotExist:
            return 'not_enrolled'
        return enrollment.status


class CourseWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = [
            'id',
            'slug',
            'title',
            'tags',
            'website',
            'short_description',
            'description',
            'thumbnail',
            'category',
            'level',
            'visibility',
            'access_rule',
            'price',
            'duration_minutes',
        ]
        read_only_fields = ['id', 'slug']


class EnrollmentSerializer(serializers.ModelSerializer):
    course = BriefCourseSerializer(read_only=True)
    learner = BriefUserSerializer(read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            'id',
            'course',
            'learner',
            'status',
            'progress_percent',
            'time_spent_seconds',
            'enrolled_at',
            'completed_at',
        ]
        read_only_fields = fields


class MyEnrollmentSerializer(serializers.ModelSerializer):
    course_id = serializers.IntegerField(source='course.id', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    course_slug = serializers.SlugField(source='course.slug', read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            'id',
            'course_id',
            'course_title',
            'course_slug',
            'status',
            'progress_percent',
            'time_spent_seconds',
            'enrolled_at',
            'completed_at',
        ]
        read_only_fields = fields


class AdminCategoryListSerializer(serializers.ModelSerializer):
    course_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'course_count', 'created_at']


class AdminCourseListSerializer(serializers.ModelSerializer):
    instructor_name = serializers.SerializerMethodField()
    category_name = serializers.SerializerMethodField()
    lesson_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Course
        fields = [
            'id',
            'title',
            'slug',
            'tags',
            'website',
            'instructor_name',
            'category_name',
            'level',
            'status',
            'lesson_count',
            'duration_minutes',
            'created_at',
        ]

    def get_instructor_name(self, obj):
        u = obj.instructor
        return u.get_full_name() or u.email

    def get_category_name(self, obj):
        return obj.category.name if obj.category_id else None


class AdminModuleListSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True)
    lesson_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Module
        fields = ['id', 'title', 'course_title', 'lesson_count', 'sort_order', 'created_at']


class AdminLessonListSerializer(serializers.ModelSerializer):
    module_title = serializers.CharField(source='module.title', read_only=True)
    course_title = serializers.CharField(source='module.course.title', read_only=True)

    class Meta:
        model = Lesson
        fields = [
            'id',
            'title',
            'module_title',
            'course_title',
            'content_type',
            'duration_minutes',
            'sort_order',
            'is_preview',
            'created_at',
        ]


class AdminEnrollmentListSerializer(serializers.ModelSerializer):
    learner_name = serializers.SerializerMethodField()
    learner_email = serializers.EmailField(source='learner.email', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            'id',
            'learner_name',
            'learner_email',
            'course_title',
            'status',
            'progress_percent',
            'time_spent_seconds',
            'enrolled_at',
            'completed_at',
        ]

    def get_learner_name(self, obj):
        u = obj.learner
        name = (u.get_full_name() or '').strip()
        return name or u.email


class AdminLessonProgressListSerializer(serializers.ModelSerializer):
    learner_name = serializers.SerializerMethodField()
    learner_email = serializers.EmailField(source='learner.email', read_only=True)
    lesson_title = serializers.CharField(source='lesson.title', read_only=True)
    course_title = serializers.CharField(source='lesson.module.course.title', read_only=True)

    class Meta:
        model = LessonProgress
        fields = [
            'id',
            'learner_name',
            'learner_email',
            'lesson_title',
            'course_title',
            'is_completed',
            'completed_at',
            'last_viewed_at',
        ]

    def get_learner_name(self, obj):
        u = obj.learner
        name = (u.get_full_name() or '').strip()
        return name or u.email
