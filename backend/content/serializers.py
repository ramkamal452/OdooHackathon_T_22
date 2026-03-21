from rest_framework import serializers

from accounts.serializers import BriefUserSerializer
from assets.models import Asset
from taxonomy.models import Category, Tag, EntityTag

from .models import (
    ContentAttachment,
    ContentEntity,
    ContentStructure,
    CourseSettings,
    EntityType,
    LessonContent,
    ResourceContent,
    StatusCode,
    VideoContent,
    AccessRuleCode,
    LevelCode,
    VisibilityCode,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

STATUS_MAP = {StatusCode.DRAFT: 'draft', StatusCode.PUBLISHED: 'published',
              StatusCode.ARCHIVED: 'archived', StatusCode.HIDDEN: 'hidden'}
STATUS_REVERSE = {v: k for k, v in STATUS_MAP.items()}

VISIBILITY_MAP = {VisibilityCode.EVERYONE: 'everyone', VisibilityCode.SIGNED_IN: 'signed_in'}
VISIBILITY_REVERSE = {v: k for k, v in VISIBILITY_MAP.items()}

ACCESS_MAP = {AccessRuleCode.OPEN: 'open', AccessRuleCode.INVITATION: 'invitation',
              AccessRuleCode.PAYMENT: 'payment'}
ACCESS_REVERSE = {v: k for k, v in ACCESS_MAP.items()}

LEVEL_MAP = {LevelCode.BEGINNER: 'beginner', LevelCode.INTERMEDIATE: 'intermediate',
             LevelCode.ADVANCED: 'advanced', None: None}
LEVEL_REVERSE = {v: k for k, v in LEVEL_MAP.items()}

ENTITY_TO_CONTENT_TYPE = {
    EntityType.VIDEO: 'video',
    EntityType.RESOURCE: 'document',
    EntityType.ARTICLE: 'document',
    EntityType.LESSON: 'document',
    EntityType.QUIZ: 'quiz',
}


def _thumbnail_url(entity, request=None):
    if entity.thumbnail_asset_id:
        try:
            asset = entity.thumbnail_asset
            return asset.url
        except Asset.DoesNotExist:
            pass
    return None


def _content_type_label(entity):
    if entity.entity_type == EntityType.VIDEO:
        return 'video'
    if entity.entity_type == EntityType.RESOURCE:
        try:
            from .models import ResourceKind
            rk = entity.resource_detail.resource_kind
            if rk == ResourceKind.IMAGE:
                return 'image'
        except Exception:
            pass
        return 'document'
    if entity.entity_type == EntityType.ARTICLE:
        return 'document'
    if entity.entity_type == EntityType.LESSON:
        return 'document'
    return 'video'


# ---------------------------------------------------------------------------
# Attachment
# ---------------------------------------------------------------------------

class ContentAttachmentSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()

    class Meta:
        model = ContentAttachment
        fields = ['id', 'title', 'file', 'url', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_file(self, obj):
        if obj.asset_id:
            return obj.asset.url
        return None

    def get_url(self, obj):
        return obj.external_url or ''


# ---------------------------------------------------------------------------
# Category (for backward compat)
# ---------------------------------------------------------------------------

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'created_at']
        read_only_fields = ['id', 'slug', 'created_at']


# ---------------------------------------------------------------------------
# Lesson serializer (child entity presented as a "lesson")
# ---------------------------------------------------------------------------

class LessonSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    module = serializers.IntegerField(source='_module_id', default=None)
    title = serializers.CharField()
    content_type = serializers.CharField()
    content_body = serializers.CharField()
    allow_download = serializers.BooleanField()
    video_url = serializers.CharField()
    resource_url = serializers.CharField()
    duration_minutes = serializers.IntegerField(allow_null=True)
    sort_order = serializers.IntegerField()
    is_preview = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    attachments = ContentAttachmentSerializer(many=True)

    @classmethod
    def from_entity(cls, entity, structure_link=None, request=None):
        content_type = _content_type_label(entity)
        content_body = ''
        video_url = ''
        resource_url = ''
        allow_download = False
        duration_minutes = None

        if entity.entity_type == EntityType.VIDEO:
            try:
                vd = entity.video_detail
                video_url = vd.video_url or ''
                allow_download = vd.allow_download
                duration_minutes = (vd.duration_seconds // 60) if vd.duration_seconds else None
            except VideoContent.DoesNotExist:
                pass
        elif entity.entity_type in (EntityType.RESOURCE, EntityType.ARTICLE, EntityType.LESSON):
            try:
                rd = entity.resource_detail
                resource_url = rd.resource_url or ''
                allow_download = rd.allow_download
            except Exception:
                pass
            try:
                ld = entity.lesson_detail
                content_body = ld.body or ''
            except Exception:
                pass
            try:
                ad = entity.article_detail
                content_body = content_body or ad.body_markdown or ''
            except Exception:
                pass

        if entity.estimated_duration_seconds and not duration_minutes:
            duration_minutes = entity.estimated_duration_seconds // 60

        attachments = ContentAttachmentSerializer(
            entity.attachments.all(), many=True
        ).data

        return {
            'id': entity.id,
            'module': getattr(structure_link, '_module_id', None) if structure_link else None,
            'title': entity.title,
            'content_type': content_type,
            'content_body': content_body,
            'allow_download': allow_download,
            'video_url': video_url,
            'resource_url': resource_url,
            'duration_minutes': duration_minutes,
            'sort_order': structure_link.sort_order if structure_link else 0,
            'is_preview': structure_link.is_preview if structure_link else False,
            'created_at': entity.created_at,
            'updated_at': entity.updated_at,
            'attachments': attachments,
        }


# ---------------------------------------------------------------------------
# Module serializer (child entity of type MODULE)
# ---------------------------------------------------------------------------

class ModuleSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    course = serializers.IntegerField(source='_course_id', default=None)
    title = serializers.CharField()
    description = serializers.CharField()
    sort_order = serializers.IntegerField()
    created_at = serializers.DateTimeField()

    @classmethod
    def from_entity(cls, entity, structure_link=None, request=None):
        return {
            'id': entity.id,
            'course': getattr(structure_link, '_course_id', None) if structure_link else None,
            'title': entity.title,
            'description': entity.description or '',
            'sort_order': structure_link.sort_order if structure_link else 0,
            'created_at': entity.created_at,
        }


class ModuleDetailSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    course = serializers.IntegerField(allow_null=True)
    title = serializers.CharField()
    description = serializers.CharField()
    sort_order = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    lessons = serializers.ListField()


# ---------------------------------------------------------------------------
# Course list serializer
# ---------------------------------------------------------------------------

class CourseListSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    slug = serializers.CharField()
    tags = serializers.CharField()
    website = serializers.CharField()
    short_description = serializers.CharField()
    thumbnail = serializers.CharField(allow_null=True)
    instructor_name = serializers.CharField()
    category_name = serializers.CharField(allow_null=True)
    level = serializers.CharField(allow_null=True)
    status = serializers.CharField()
    visibility = serializers.CharField()
    access_rule = serializers.CharField()
    lesson_count = serializers.IntegerField()
    enrollment_count = serializers.IntegerField()
    duration_minutes = serializers.IntegerField(allow_null=True)
    created_at = serializers.DateTimeField()

    @classmethod
    def from_entity(cls, entity, request=None):
        settings = getattr(entity, '_course_settings', None)
        if not settings:
            try:
                settings = entity.course_settings
            except CourseSettings.DoesNotExist:
                settings = None

        tags_list = list(
            EntityTag.objects.filter(entity=entity)
            .select_related('tag')
            .values_list('tag__name', flat=True)
        )
        tags_str = ', '.join(tags_list)

        cat = None
        try:
            ec = entity.entity_categories.select_related('category').first()
            if ec:
                cat = ec.category.name
        except Exception:
            pass

        lesson_count = getattr(entity, '_lesson_count', 0)
        enrollment_count = getattr(entity, '_enrollment_count', 0)

        return {
            'id': entity.id,
            'title': entity.title,
            'slug': entity.slug,
            'tags': tags_str,
            'website': settings.website if settings else '',
            'short_description': entity.short_description or '',
            'thumbnail': _thumbnail_url(entity, request),
            'instructor_name': entity.owner.get_full_name() or entity.owner.email,
            'category_name': cat,
            'level': LEVEL_MAP.get(settings.level_code) if settings else None,
            'status': STATUS_MAP.get(entity.status_code, 'draft'),
            'visibility': VISIBILITY_MAP.get(settings.visibility_code) if settings else 'everyone',
            'access_rule': ACCESS_MAP.get(settings.access_rule_code) if settings else 'open',
            'lesson_count': lesson_count,
            'enrollment_count': enrollment_count,
            'duration_minutes': (entity.estimated_duration_seconds // 60) if entity.estimated_duration_seconds else None,
            'created_at': entity.created_at,
        }


# ---------------------------------------------------------------------------
# Course detail serializer — reconstructs modules[].lessons[]
# ---------------------------------------------------------------------------

class CourseDetailSerializer(serializers.Serializer):

    @classmethod
    def from_entity(cls, entity, user=None, request=None):
        settings_obj = None
        try:
            settings_obj = entity.course_settings
        except CourseSettings.DoesNotExist:
            pass

        tags_list = list(
            EntityTag.objects.filter(entity=entity)
            .select_related('tag')
            .values_list('tag__name', flat=True)
        )

        cat_data = None
        try:
            ec = entity.entity_categories.select_related('category').first()
            if ec:
                cat_data = {'id': ec.category.id, 'name': ec.category.name, 'slug': ec.category.slug, 'created_at': ec.category.created_at}
        except Exception:
            pass

        child_links = list(
            ContentStructure.objects.filter(parent_entity=entity)
            .select_related('child_entity', 'child_entity__owner')
            .order_by('sort_order')
        )

        module_entities = []
        direct_lessons = []
        for link in child_links:
            child = link.child_entity
            if child.entity_type == EntityType.MODULE:
                module_entities.append((child, link))
            else:
                direct_lessons.append((child, link))

        modules_data = []
        for mod_entity, mod_link in module_entities:
            mod_child_links = list(
                ContentStructure.objects.filter(parent_entity=mod_entity)
                .select_related(
                    'child_entity',
                    'child_entity__owner',
                )
                .order_by('sort_order')
            )
            lessons = []
            for clink in mod_child_links:
                lesson_data = LessonSerializer.from_entity(
                    clink.child_entity, clink, request
                )
                lesson_data['module'] = mod_entity.id
                lessons.append(lesson_data)

            modules_data.append({
                'id': mod_entity.id,
                'course': entity.id,
                'title': mod_entity.title,
                'description': mod_entity.description or '',
                'sort_order': mod_link.sort_order,
                'created_at': mod_entity.created_at,
                'lessons': lessons,
            })

        if direct_lessons:
            dl_items = []
            for child, link in direct_lessons:
                lesson_data = LessonSerializer.from_entity(child, link, request)
                lesson_data['module'] = None
                dl_items.append(lesson_data)
            if dl_items:
                modules_data.insert(0, {
                    'id': 0,
                    'course': entity.id,
                    'title': 'Course Content',
                    'description': '',
                    'sort_order': -1,
                    'created_at': entity.created_at,
                    'lessons': dl_items,
                })

        enrollment_status = None
        if user and user.is_authenticated:
            from enrollment.models import CourseMembership, MembershipStatus
            role = getattr(user, 'role', None)
            if role == 'admin' or (role == 'instructor' and entity.owner_id == user.id):
                enrollment_status = 'owner'
            else:
                try:
                    mem = CourseMembership.objects.get(
                        course_entity=entity, user=user,
                    )
                    status_map = {
                        MembershipStatus.INVITED: 'invited',
                        MembershipStatus.ACTIVE: 'in_progress',
                        MembershipStatus.COMPLETED: 'completed',
                    }
                    enrollment_status = status_map.get(mem.membership_status, 'not_enrolled')
                    if mem.membership_status == MembershipStatus.ACTIVE and mem.progress_percent == 0:
                        enrollment_status = 'yet_to_start'
                except CourseMembership.DoesNotExist:
                    enrollment_status = 'not_enrolled'

        from reviews.models import CourseReview
        reviews_qs = CourseReview.objects.filter(
            course_entity=entity, is_published=True,
        ).select_related('user').order_by('-created_at')
        reviews_data = []
        for r in reviews_qs:
            avatar_url = None
            if r.user.avatar:
                avatar_url = r.user.avatar.url
            reviews_data.append({
                'id': r.id,
                'course': entity.id,
                'user': r.user_id,
                'user_name': r.user.get_full_name() or r.user.email,
                'user_avatar': avatar_url,
                'rating': r.rating,
                'review_text': r.review_text,
                'created_at': r.created_at,
            })

        instructor = entity.owner
        return {
            'id': entity.id,
            'title': entity.title,
            'slug': entity.slug,
            'tags': ', '.join(tags_list),
            'website': settings_obj.website if settings_obj else '',
            'short_description': entity.short_description or '',
            'description': entity.description or '',
            'thumbnail': _thumbnail_url(entity, request),
            'instructor': BriefUserSerializer(instructor).data,
            'category': cat_data,
            'level': LEVEL_MAP.get(settings_obj.level_code) if settings_obj else None,
            'status': STATUS_MAP.get(entity.status_code, 'draft'),
            'visibility': VISIBILITY_MAP.get(settings_obj.visibility_code) if settings_obj else 'everyone',
            'access_rule': ACCESS_MAP.get(settings_obj.access_rule_code) if settings_obj else 'open',
            'price': str(settings_obj.price) if settings_obj and settings_obj.price else None,
            'duration_minutes': (entity.estimated_duration_seconds // 60) if entity.estimated_duration_seconds else None,
            'created_at': entity.created_at,
            'updated_at': entity.updated_at,
            'modules': modules_data,
            'enrollment_status': enrollment_status,
            'reviews': reviews_data,
        }


# ---------------------------------------------------------------------------
# Course write serializer
# ---------------------------------------------------------------------------

class CourseWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    short_description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    thumbnail = serializers.ImageField(required=False, allow_null=True)
    category = serializers.IntegerField(required=False, allow_null=True)
    tags = serializers.CharField(required=False, allow_blank=True)
    website = serializers.CharField(required=False, allow_blank=True)
    level = serializers.CharField(required=False, allow_blank=True)
    visibility = serializers.CharField(required=False, allow_blank=True)
    access_rule = serializers.CharField(required=False, allow_blank=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    duration_minutes = serializers.IntegerField(required=False, allow_null=True)
