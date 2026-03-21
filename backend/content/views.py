from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import (
    IsInstructorOrAdmin,
    IsLearner,
    can_access_content,
    can_manage_entity,
    can_view_entity,
    learner_has_membership,
)
from assets.models import Asset
from taxonomy.models import Category, EntityCategory, EntityTag, Tag

from .models import (
    AccessRuleCode,
    ContentAttachment,
    ContentEntity,
    ContentStructure,
    CourseSettings,
    EntityStats,
    EntityType,
    LevelCode,
    QuizContent,
    ResourceContent,
    ResourceKind,
    StatusCode,
    VideoContent,
    VisibilityCode,
)
from .serializers import (
    ACCESS_REVERSE,
    LEVEL_REVERSE,
    STATUS_MAP,
    VISIBILITY_REVERSE,
    CourseDetailSerializer,
    CourseListSerializer,
    LessonSerializer,
    ModuleSerializer,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _course_qs(user):
    qs = ContentEntity.objects.filter(entity_type=EntityType.COURSE).select_related(
        'owner', 'thumbnail_asset', 'course_settings',
    )
    role = getattr(user, 'role', None)
    if role == 'admin':
        return qs
    if role == 'instructor':
        return qs.filter(Q(owner=user) | Q(status_code=StatusCode.PUBLISHED))
    return qs.filter(status_code=StatusCode.PUBLISHED)


def _annotate_counts(qs):
    return qs.annotate(
        _enrollment_count=Count('memberships', distinct=True),
        _lesson_count=Count('children_links', distinct=True),
    )


def _find_course_for_child(entity):
    from content.models import ContentStructure, EntityType
    parents = ContentStructure.objects.filter(child_entity=entity).select_related('parent_entity')
    for link in parents:
        p = link.parent_entity
        if p.entity_type == EntityType.COURSE:
            return p
        if p.entity_type == EntityType.MODULE:
            gp_links = ContentStructure.objects.filter(child_entity=p).select_related('parent_entity')
            for gl in gp_links:
                if gl.parent_entity.entity_type == EntityType.COURSE:
                    return gl.parent_entity
    return None


# ---------------------------------------------------------------------------
# Category views (backward compat with /api/categories/)
# ---------------------------------------------------------------------------

class CategoryListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from taxonomy.serializers import CategorySerializer
        cats = Category.objects.all().order_by('name')
        return Response(CategorySerializer(cats, many=True).data)

    def post(self, request):
        role = getattr(request.user, 'role', None)
        if role not in ('admin', 'instructor'):
            raise PermissionDenied()
        from taxonomy.serializers import CategorySerializer
        ser = CategorySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data, status=status.HTTP_201_CREATED)


class CategoryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from taxonomy.serializers import CategoryDetailSerializer
        cat = get_object_or_404(Category, pk=pk)
        course_count = EntityCategory.objects.filter(
            category=cat, entity__entity_type=EntityType.COURSE,
        ).count()
        data = {
            'id': cat.id, 'name': cat.name, 'slug': cat.slug,
            'created_at': cat.created_at, 'course_count': course_count,
        }
        return Response(data)

    def put(self, request, pk):
        return self._update(request, pk)

    def patch(self, request, pk):
        return self._update(request, pk)

    def _update(self, request, pk):
        if getattr(request.user, 'role', None) != 'admin':
            raise PermissionDenied()
        cat = get_object_or_404(Category, pk=pk)
        for field in ('name',):
            if field in request.data:
                setattr(cat, field, request.data[field])
        cat.save()
        from taxonomy.serializers import CategorySerializer
        return Response(CategorySerializer(cat).data)

    def delete(self, request, pk):
        if getattr(request.user, 'role', None) != 'admin':
            raise PermissionDenied()
        get_object_or_404(Category, pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Course views
# ---------------------------------------------------------------------------

class CourseListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = _annotate_counts(_course_qs(request.user))
        search = request.query_params.get('search')
        category = request.query_params.get('category')
        level = request.query_params.get('level')
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(short_description__icontains=search))
        if category:
            qs = qs.filter(entity_categories__category_id=category)
        if level:
            level_code = LEVEL_REVERSE.get(level)
            if level_code is not None:
                qs = qs.filter(course_settings__level_code=level_code)
        qs = qs.order_by('-created_at')
        data = [CourseListSerializer.from_entity(e, request) for e in qs]
        return Response(data)

    def post(self, request):
        role = getattr(request.user, 'role', None)
        if role not in ('admin', 'instructor'):
            raise PermissionDenied('Only instructors and admins can create courses.')
        data = request.data
        title = data.get('title', '').strip()
        if not title:
            return Response({'title': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

        entity = ContentEntity.objects.create(
            entity_type=EntityType.COURSE,
            title=title,
            short_description=data.get('short_description', ''),
            description=data.get('description', ''),
            owner=request.user,
            status_code=StatusCode.DRAFT,
        )

        level_str = data.get('level', '')
        level_code = LEVEL_REVERSE.get(level_str)
        vis_str = data.get('visibility', 'everyone')
        vis_code = VISIBILITY_REVERSE.get(vis_str, VisibilityCode.EVERYONE)
        access_str = data.get('access_rule', 'open')
        access_code = ACCESS_REVERSE.get(access_str, AccessRuleCode.OPEN)
        price = data.get('price')

        CourseSettings.objects.create(
            entity=entity,
            level_code=level_code,
            visibility_code=vis_code,
            access_rule_code=access_code,
            price=price if price else None,
            website=data.get('website', ''),
        )

        EntityStats.objects.create(entity=entity)

        cat_id = data.get('category')
        if cat_id:
            try:
                cat = Category.objects.get(pk=int(cat_id))
                EntityCategory.objects.create(entity=entity, category=cat)
            except (Category.DoesNotExist, ValueError):
                pass

        tags_str = data.get('tags', '')
        if tags_str:
            for tag_name in [t.strip() for t in tags_str.split(',') if t.strip()]:
                tag_obj, _ = Tag.objects.get_or_create(name=tag_name)
                EntityTag.objects.get_or_create(entity=entity, tag=tag_obj)

        thumbnail = request.FILES.get('thumbnail')
        if thumbnail:
            entity.thumbnail_asset = _create_file_asset(thumbnail, request.user)
            entity.save(update_fields=['thumbnail_asset'])

        duration = data.get('duration_minutes')
        if duration:
            try:
                entity.estimated_duration_seconds = int(duration) * 60
                entity.save(update_fields=['estimated_duration_seconds'])
            except (ValueError, TypeError):
                pass

        return Response({'id': entity.id, 'slug': entity.slug}, status=status.HTTP_201_CREATED)


class CourseDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        entity = get_object_or_404(
            ContentEntity.objects.select_related('owner', 'thumbnail_asset', 'course_settings'),
            pk=pk, entity_type=EntityType.COURSE,
        )
        if not can_view_entity(request.user, entity):
            raise NotFound()
        data = CourseDetailSerializer.from_entity(entity, user=request.user, request=request)
        return Response(data)

    def put(self, request, pk):
        return self._update(request, pk)

    def patch(self, request, pk):
        return self._update(request, pk)

    def _update(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk, entity_type=EntityType.COURSE)
        if not can_manage_entity(request.user, entity):
            raise PermissionDenied('You do not have permission to update this course.')
        data = request.data

        for field in ('title', 'short_description', 'description'):
            if field in data:
                setattr(entity, field, data[field])

        thumbnail = request.FILES.get('thumbnail')
        if thumbnail:
            entity.thumbnail_asset = _create_file_asset(thumbnail, request.user)

        duration = data.get('duration_minutes')
        if duration is not None:
            try:
                entity.estimated_duration_seconds = int(duration) * 60
            except (ValueError, TypeError):
                pass

        entity.save()

        settings_obj, _ = CourseSettings.objects.get_or_create(entity=entity)
        if 'level' in data:
            settings_obj.level_code = LEVEL_REVERSE.get(data['level'])
        if 'visibility' in data:
            settings_obj.visibility_code = VISIBILITY_REVERSE.get(data['visibility'], VisibilityCode.EVERYONE)
        if 'access_rule' in data:
            settings_obj.access_rule_code = ACCESS_REVERSE.get(data['access_rule'], AccessRuleCode.OPEN)
        if 'price' in data:
            settings_obj.price = data['price'] or None
        if 'website' in data:
            settings_obj.website = data['website'] or ''
        settings_obj.save()

        if 'category' in data:
            EntityCategory.objects.filter(entity=entity).delete()
            cat_id = data.get('category')
            if cat_id:
                try:
                    cat = Category.objects.get(pk=int(cat_id))
                    EntityCategory.objects.create(entity=entity, category=cat)
                except (Category.DoesNotExist, ValueError):
                    pass

        if 'tags' in data:
            EntityTag.objects.filter(entity=entity).delete()
            tags_str = data.get('tags', '')
            if tags_str:
                for tag_name in [t.strip() for t in tags_str.split(',') if t.strip()]:
                    tag_obj, _ = Tag.objects.get_or_create(name=tag_name)
                    EntityTag.objects.get_or_create(entity=entity, tag=tag_obj)

        detail = CourseDetailSerializer.from_entity(entity, user=request.user, request=request)
        return Response(detail)

    def delete(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk, entity_type=EntityType.COURSE)
        if not can_manage_entity(request.user, entity):
            raise PermissionDenied('You do not have permission to delete this course.')
        entity.deleted_at = timezone.now()
        entity.save(update_fields=['deleted_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class CoursePublishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk, entity_type=EntityType.COURSE)
        if not can_manage_entity(request.user, entity):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        if entity.status_code == StatusCode.PUBLISHED:
            entity.status_code = StatusCode.DRAFT
            entity.published_at = None
        else:
            entity.status_code = StatusCode.PUBLISHED
            entity.published_at = timezone.now()
        entity.save(update_fields=['status_code', 'published_at', 'updated_at'])
        return Response({
            'id': entity.id,
            'status': STATUS_MAP.get(entity.status_code, 'draft'),
        })


# ---------------------------------------------------------------------------
# Module views
# ---------------------------------------------------------------------------

class ModuleListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        course = get_object_or_404(ContentEntity, pk=course_id, entity_type=EntityType.COURSE)
        if not can_view_entity(request.user, course):
            raise NotFound()
        links = ContentStructure.objects.filter(
            parent_entity=course,
            child_entity__entity_type=EntityType.MODULE,
        ).select_related('child_entity').order_by('sort_order')
        data = []
        for link in links:
            d = ModuleSerializer.from_entity(link.child_entity, link)
            d['course'] = course.id
            data.append(d)
        return Response(data)

    def post(self, request, course_id):
        course = get_object_or_404(ContentEntity, pk=course_id, entity_type=EntityType.COURSE)
        if not can_manage_entity(request.user, course):
            raise PermissionDenied('You do not have permission to add modules.')
        title = request.data.get('title', '').strip()
        if not title:
            return Response({'title': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)
        mod = ContentEntity.objects.create(
            entity_type=EntityType.MODULE,
            title=title,
            description=request.data.get('description', ''),
            owner=request.user,
            status_code=StatusCode.PUBLISHED,
        )
        max_order = ContentStructure.objects.filter(parent_entity=course).count()
        link = ContentStructure.objects.create(
            parent_entity=course,
            child_entity=mod,
            sort_order=request.data.get('sort_order', max_order),
        )
        d = ModuleSerializer.from_entity(mod, link)
        d['course'] = course.id
        return Response(d, status=status.HTTP_201_CREATED)


class ModuleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        mod = get_object_or_404(ContentEntity, pk=pk, entity_type=EntityType.MODULE)
        course = _find_course_for_child(mod)
        if course and not can_view_entity(request.user, course):
            raise NotFound()
        child_links = ContentStructure.objects.filter(
            parent_entity=mod,
        ).select_related('child_entity').order_by('sort_order')
        lessons = [LessonSerializer.from_entity(cl.child_entity, cl, request) for cl in child_links]
        for ld in lessons:
            ld['module'] = mod.id
        link = ContentStructure.objects.filter(child_entity=mod).first()
        data = ModuleSerializer.from_entity(mod, link)
        data['course'] = course.id if course else None
        data['lessons'] = lessons
        return Response(data)

    def put(self, request, pk):
        return self._update(request, pk)

    def patch(self, request, pk):
        return self._update(request, pk)

    def _update(self, request, pk):
        mod = get_object_or_404(ContentEntity, pk=pk, entity_type=EntityType.MODULE)
        course = _find_course_for_child(mod)
        if course and not can_manage_entity(request.user, course):
            raise PermissionDenied()
        for field in ('title', 'description'):
            if field in request.data:
                setattr(mod, field, request.data[field])
        mod.save()
        if 'sort_order' in request.data:
            link = ContentStructure.objects.filter(child_entity=mod).first()
            if link:
                link.sort_order = int(request.data['sort_order'])
                link.save(update_fields=['sort_order'])
        link = ContentStructure.objects.filter(child_entity=mod).first()
        data = ModuleSerializer.from_entity(mod, link)
        data['course'] = course.id if course else None
        return Response(data)

    def delete(self, request, pk):
        mod = get_object_or_404(ContentEntity, pk=pk, entity_type=EntityType.MODULE)
        course = _find_course_for_child(mod)
        if course and not can_manage_entity(request.user, course):
            raise PermissionDenied()
        mod.deleted_at = timezone.now()
        mod.save(update_fields=['deleted_at'])
        ContentStructure.objects.filter(child_entity=mod).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Lesson views (content items under modules)
# ---------------------------------------------------------------------------

class LessonListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, module_id):
        mod = get_object_or_404(ContentEntity, pk=module_id, entity_type=EntityType.MODULE)
        course = _find_course_for_child(mod)
        if course and not can_view_entity(request.user, course):
            raise NotFound()
        links = ContentStructure.objects.filter(
            parent_entity=mod,
        ).select_related('child_entity').order_by('sort_order')
        data = []
        for link in links:
            ld = LessonSerializer.from_entity(link.child_entity, link, request)
            ld['module'] = mod.id
            data.append(ld)
        return Response(data)

    def post(self, request, module_id):
        mod = get_object_or_404(ContentEntity, pk=module_id, entity_type=EntityType.MODULE)
        course = _find_course_for_child(mod)
        if course and not can_manage_entity(request.user, course):
            raise PermissionDenied()

        entity, result = _create_lesson_entity(request.data, request.FILES, request.user, mod)
        if entity is None:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        ld = LessonSerializer.from_entity(entity, result, request)
        ld['module'] = mod.id
        return Response(ld, status=status.HTTP_201_CREATED)


class LessonDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk)
        if not can_access_content(request.user, entity):
            raise PermissionDenied('You do not have access to this lesson.')
        link = ContentStructure.objects.filter(child_entity=entity).first()
        data = LessonSerializer.from_entity(entity, link, request)
        if link:
            data['module'] = link.parent_entity_id
        return Response(data)

    def put(self, request, pk):
        return self._update(request, pk)

    def patch(self, request, pk):
        return self._update(request, pk)

    def _update(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk)
        course = _find_course_for_child(entity)
        if course and not can_manage_entity(request.user, course):
            raise PermissionDenied()
        data = request.data

        if 'title' in data:
            entity.title = data['title']
        dur = data.get('duration_minutes')
        if dur is not None:
            try:
                entity.estimated_duration_seconds = int(dur) * 60
            except (ValueError, TypeError):
                pass
        entity.save()

        file_obj = request.FILES.get('file')

        if entity.entity_type == EntityType.VIDEO:
            vd, _ = VideoContent.objects.get_or_create(entity=entity)
            if file_obj:
                asset = _create_file_asset(file_obj, request.user)
                vd.video_url = asset.url
            elif 'video_url' in data:
                vd.video_url = data['video_url']
            if 'allow_download' in data:
                vd.allow_download = data['allow_download']
            if dur:
                try:
                    vd.duration_seconds = int(dur) * 60
                except (ValueError, TypeError):
                    pass
            vd.save()
        elif entity.entity_type == EntityType.RESOURCE:
            rd, _ = ResourceContent.objects.get_or_create(entity=entity)
            if file_obj:
                asset = _create_file_asset(file_obj, request.user)
                rd.resource_url = asset.url
                rd.asset = asset
            elif 'resource_url' in data:
                rd.resource_url = data['resource_url']
            if 'allow_download' in data:
                rd.allow_download = data['allow_download']
            rd.save()

        if 'content_body' in data:
            from .models import LessonContent
            ld_obj, _ = LessonContent.objects.get_or_create(entity=entity)
            ld_obj.body = data['content_body']
            ld_obj.save()

        link = ContentStructure.objects.filter(child_entity=entity).first()
        if link:
            if 'sort_order' in data:
                link.sort_order = int(data['sort_order'])
            if 'is_preview' in data:
                link.is_preview = bool(data['is_preview'])
            link.save()

        result = LessonSerializer.from_entity(entity, link, request)
        if link:
            result['module'] = link.parent_entity_id
        return Response(result)

    def delete(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk)
        course = _find_course_for_child(entity)
        if course and not can_manage_entity(request.user, course):
            raise PermissionDenied()
        entity.deleted_at = timezone.now()
        entity.save(update_fields=['deleted_at'])
        ContentStructure.objects.filter(child_entity=entity).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LessonCompleteView(APIView):
    permission_classes = [IsAuthenticated, IsLearner]

    def post(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk)
        course = _find_course_for_child(entity)
        if not course or not learner_has_membership(request.user, course):
            return Response({'detail': 'Not enrolled in this course.'}, status=status.HTTP_403_FORBIDDEN)

        from enrollment.models import CourseMembership, EntityProgress, MembershipStatus, ProgressStatus
        membership = get_object_or_404(CourseMembership, course_entity=course, user=request.user)
        now = timezone.now()
        progress, created = EntityProgress.objects.get_or_create(
            learner=request.user,
            entity=entity,
            defaults={
                'progress_status': ProgressStatus.COMPLETED,
                'progress_percent': 100,
                'completed_at': now,
                'last_accessed_at': now,
            },
        )
        if not created:
            progress.progress_status = ProgressStatus.COMPLETED
            progress.progress_percent = 100
            progress.completed_at = now
            progress.last_accessed_at = now
            progress.save(update_fields=['progress_status', 'progress_percent', 'completed_at', 'last_accessed_at', 'updated_at'])

        membership.recalculate_progress()
        membership.refresh_from_db()
        return Response({
            'lesson_id': entity.id,
            'completed': True,
            'progress_percent': membership.progress_percent,
        })


# ---------------------------------------------------------------------------
# Admin list views
# ---------------------------------------------------------------------------

class AdminCourseListView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request):
        from rest_framework.pagination import PageNumberPagination
        qs = ContentEntity.objects.filter(entity_type=EntityType.COURSE).select_related(
            'owner', 'course_settings',
        ).order_by('-created_at')

        search = request.query_params.get('search')
        status_param = request.query_params.get('status')
        category = request.query_params.get('category')
        level = request.query_params.get('level')
        if search:
            qs = qs.filter(title__icontains=search)
        if status_param:
            code = {'draft': StatusCode.DRAFT, 'published': StatusCode.PUBLISHED}.get(status_param)
            if code:
                qs = qs.filter(status_code=code)
        if category:
            qs = qs.filter(entity_categories__category_id=category)
        if level:
            code = LEVEL_REVERSE.get(level)
            if code:
                qs = qs.filter(course_settings__level_code=code)

        qs = qs.annotate(_lesson_count=Count('children_links', distinct=True))

        paginator = PageNumberPagination()
        paginator.page_size = request.query_params.get('page_size', 10)
        page = paginator.paginate_queryset(qs, request)

        results = []
        for e in (page or qs):
            settings_obj = getattr(e, 'course_settings', None)
            cat_name = None
            try:
                ec = e.entity_categories.select_related('category').first()
                if ec:
                    cat_name = ec.category.name
            except Exception:
                pass
            results.append({
                'id': e.id,
                'title': e.title,
                'slug': e.slug,
                'tags': '',
                'website': settings_obj.website if settings_obj else '',
                'instructor_name': e.owner.get_full_name() or e.owner.email,
                'category_name': cat_name,
                'level': LEVEL_REVERSE.get(settings_obj.level_code) if settings_obj and settings_obj.level_code else None,
                'status': STATUS_MAP.get(e.status_code, 'draft'),
                'lesson_count': getattr(e, '_lesson_count', 0),
                'duration_minutes': (e.estimated_duration_seconds // 60) if e.estimated_duration_seconds else None,
                'created_at': e.created_at,
            })

        if page is not None:
            return paginator.get_paginated_response(results)
        return Response(results)


class AdminModuleListView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request):
        from rest_framework.pagination import PageNumberPagination
        links = ContentStructure.objects.filter(
            child_entity__entity_type=EntityType.MODULE,
        ).select_related(
            'child_entity', 'parent_entity',
        ).order_by('parent_entity_id', 'sort_order')

        search = request.query_params.get('search')
        course_id = request.query_params.get('course')
        if search:
            links = links.filter(
                Q(child_entity__title__icontains=search) | Q(parent_entity__title__icontains=search)
            )
        if course_id:
            links = links.filter(parent_entity_id=course_id)

        paginator = PageNumberPagination()
        paginator.page_size = request.query_params.get('page_size', 10)
        page = paginator.paginate_queryset(links, request)

        results = []
        for link in (page or links):
            mod = link.child_entity
            lesson_count = ContentStructure.objects.filter(parent_entity=mod).count()
            results.append({
                'id': mod.id,
                'title': mod.title,
                'course_title': link.parent_entity.title,
                'lesson_count': lesson_count,
                'sort_order': link.sort_order,
                'description': mod.description,
                'created_at': mod.created_at,
            })
        if page is not None:
            return paginator.get_paginated_response(results)
        return Response(results)


class AdminLessonListView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request):
        from rest_framework.pagination import PageNumberPagination
        non_module_types = [EntityType.VIDEO, EntityType.RESOURCE, EntityType.ARTICLE, EntityType.LESSON, EntityType.QUIZ]
        links = ContentStructure.objects.filter(
            child_entity__entity_type__in=non_module_types,
        ).select_related('child_entity', 'parent_entity')

        search = request.query_params.get('search')
        course_id = request.query_params.get('course')
        module_id = request.query_params.get('module')
        content_type = request.query_params.get('content_type')
        if search:
            links = links.filter(child_entity__title__icontains=search)
        if module_id:
            links = links.filter(parent_entity_id=module_id)
        if course_id:
            module_ids = list(ContentStructure.objects.filter(
                parent_entity_id=course_id,
                child_entity__entity_type=EntityType.MODULE,
            ).values_list('child_entity_id', flat=True))
            links = links.filter(Q(parent_entity_id=course_id) | Q(parent_entity_id__in=module_ids))
        if content_type:
            type_map = {'video': EntityType.VIDEO, 'document': EntityType.RESOURCE, 'image': EntityType.RESOURCE}
            etype = type_map.get(content_type)
            if etype:
                links = links.filter(child_entity__entity_type=etype)

        links = links.order_by('parent_entity_id', 'sort_order')

        paginator = PageNumberPagination()
        paginator.page_size = request.query_params.get('page_size', 10)
        page = paginator.paginate_queryset(links, request)

        results = []
        for link in (page or links):
            child = link.child_entity
            parent = link.parent_entity
            course_title = ''
            module_title = ''
            if parent.entity_type == EntityType.MODULE:
                module_title = parent.title
                course_link = ContentStructure.objects.filter(child_entity=parent).select_related('parent_entity').first()
                if course_link:
                    course_title = course_link.parent_entity.title
            else:
                course_title = parent.title

            results.append({
                'id': child.id,
                'title': child.title,
                'module_title': module_title,
                'course_title': course_title,
                'content_type': _content_type_label(child),
                'duration_minutes': (child.estimated_duration_seconds // 60) if child.estimated_duration_seconds else None,
                'sort_order': link.sort_order,
                'is_preview': link.is_preview,
                'created_at': child.created_at,
            })
        if page is not None:
            return paginator.get_paginated_response(results)
        return Response(results)


class AdminCategoryListView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request):
        from rest_framework.pagination import PageNumberPagination
        qs = Category.objects.annotate(
            course_count=Count('entity_categories', distinct=True),
        ).order_by('name')

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search)

        paginator = PageNumberPagination()
        paginator.page_size = int(request.query_params.get('page_size', 10))
        page = paginator.paginate_queryset(qs, request)

        results = []
        for cat in (page or qs):
            results.append({
                'id': cat.id,
                'name': cat.name,
                'slug': cat.slug,
                'course_count': getattr(cat, 'course_count', 0),
                'created_at': cat.created_at,
            })

        if page is not None:
            return paginator.get_paginated_response(results)
        return Response(results)


def _content_type_label(entity):
    if entity.entity_type == EntityType.VIDEO:
        return 'video'
    if entity.entity_type == EntityType.RESOURCE:
        try:
            if entity.resource_detail.resource_kind == ResourceKind.IMAGE:
                return 'image'
        except Exception:
            pass
        return 'document'
    return 'document'


def _create_file_asset(file_obj, user):
    return Asset.upload_file(file_obj, user=user)


def _parse_bool(val, default=False):
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ('true', '1', 'yes', 'on')
    return default


def _entity_type_for_content(content_type):
    if content_type == 'video':
        return EntityType.VIDEO
    return EntityType.RESOURCE


def _resource_kind_for_content(content_type):
    if content_type == 'image':
        return ResourceKind.IMAGE
    if content_type == 'pdf':
        return ResourceKind.PDF
    return ResourceKind.ATTACHMENT


def _create_lesson_entity(data, files, user, parent_entity):
    title = data.get('title', '').strip()
    content_type = data.get('content_type', 'text')
    if not title:
        return None, {'title': ['This field is required.']}

    etype = _entity_type_for_content(content_type)
    dur = data.get('duration_minutes')

    entity = ContentEntity.objects.create(
        entity_type=etype,
        title=title,
        owner=user,
        status_code=StatusCode.PUBLISHED,
        estimated_duration_seconds=(int(dur) * 60) if dur else None,
    )

    file_obj = files.get('file') if files else None

    if etype == EntityType.VIDEO:
        video_url = data.get('video_url', '')
        if file_obj:
            asset = _create_file_asset(file_obj, user)
            video_url = asset.url
        VideoContent.objects.create(
            entity=entity,
            video_url=video_url,
            allow_download=_parse_bool(data.get('allow_download', False)),
            duration_seconds=(int(dur) * 60) if dur else 0,
        )
    else:
        rk = _resource_kind_for_content(content_type)
        resource_url = data.get('resource_url', '')
        asset_fk = None
        if file_obj:
            asset = _create_file_asset(file_obj, user)
            resource_url = asset.url
            asset_fk = asset
        ResourceContent.objects.create(
            entity=entity,
            resource_url=resource_url,
            resource_kind=rk,
            allow_download=_parse_bool(data.get('allow_download', False)),
            asset=asset_fk,
        )

    if data.get('content_body'):
        from .models import LessonContent
        LessonContent.objects.create(entity=entity, body=data['content_body'])

    max_order = ContentStructure.objects.filter(parent_entity=parent_entity).count()
    link = ContentStructure.objects.create(
        parent_entity=parent_entity,
        child_entity=entity,
        sort_order=data.get('sort_order', max_order),
        is_preview=_parse_bool(data.get('is_preview', False)),
    )
    return entity, link


# ---------------------------------------------------------------------------
# Course-level lesson views (direct children of course, not under a module)
# ---------------------------------------------------------------------------

class CourseLessonListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        course = get_object_or_404(ContentEntity, pk=course_id, entity_type=EntityType.COURSE)
        if not can_view_entity(request.user, course):
            raise NotFound()
        non_module_types = [EntityType.VIDEO, EntityType.RESOURCE, EntityType.ARTICLE, EntityType.LESSON]
        links = ContentStructure.objects.filter(
            parent_entity=course,
            child_entity__entity_type__in=non_module_types,
        ).select_related('child_entity').order_by('sort_order')
        data = []
        for link in links:
            ld = LessonSerializer.from_entity(link.child_entity, link, request)
            ld['module'] = None
            data.append(ld)
        return Response(data)

    def post(self, request, course_id):
        course = get_object_or_404(ContentEntity, pk=course_id, entity_type=EntityType.COURSE)
        if not can_manage_entity(request.user, course):
            raise PermissionDenied()

        entity, result = _create_lesson_entity(request.data, request.FILES, request.user, course)
        if entity is None:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        ld = LessonSerializer.from_entity(entity, result, request)
        ld['module'] = None
        return Response(ld, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Lesson attachment views
# ---------------------------------------------------------------------------

class LessonAttachmentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, lesson_id):
        entity = get_object_or_404(ContentEntity, pk=lesson_id)
        course = _find_course_for_child(entity)
        if course and not can_view_entity(request.user, course):
            raise NotFound()
        from .serializers import ContentAttachmentSerializer
        attachments = ContentAttachment.objects.filter(entity=entity).order_by('sort_order')
        return Response(ContentAttachmentSerializer(attachments, many=True).data)

    def post(self, request, lesson_id):
        entity = get_object_or_404(ContentEntity, pk=lesson_id)
        course = _find_course_for_child(entity)
        if course and not can_manage_entity(request.user, course):
            raise PermissionDenied()

        file_obj = request.FILES.get('file')
        title = request.data.get('title', '')
        external_url = request.data.get('external_url', '')

        if not file_obj and not external_url:
            return Response({'file': ['A file or external URL is required.']}, status=status.HTTP_400_BAD_REQUEST)

        asset = None
        if file_obj:
            asset = _create_file_asset(file_obj, request.user)
            if not title:
                title = file_obj.name

        max_order = ContentAttachment.objects.filter(entity=entity).count()
        attachment = ContentAttachment.objects.create(
            entity=entity,
            title=title or 'Attachment',
            asset=asset,
            external_url=external_url,
            sort_order=request.data.get('sort_order', max_order),
        )

        from .serializers import ContentAttachmentSerializer
        return Response(ContentAttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)


class AttachmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        attachment = get_object_or_404(ContentAttachment, pk=pk)
        entity = attachment.entity
        course = _find_course_for_child(entity)
        if course and not can_manage_entity(request.user, course):
            raise PermissionDenied()
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Lesson-level quiz views
# ---------------------------------------------------------------------------

class LessonQuizListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, lesson_id):
        entity = get_object_or_404(ContentEntity, pk=lesson_id)
        links = ContentStructure.objects.filter(
            parent_entity=entity,
            child_entity__entity_type=EntityType.QUIZ,
        ).select_related('child_entity').order_by('sort_order')
        data = []
        for link in links:
            qe = link.child_entity
            data.append({
                'id': qe.id,
                'title': qe.title,
                'description': qe.description or '',
                'is_published': qe.status_code == StatusCode.PUBLISHED,
                'created_at': qe.created_at,
            })
        return Response(data)

    def post(self, request, lesson_id):
        entity = get_object_or_404(ContentEntity, pk=lesson_id)
        course = _find_course_for_child(entity)
        if course and not can_manage_entity(request.user, course):
            raise PermissionDenied()

        return _create_quiz_under_parent(request, entity, course)


# ---------------------------------------------------------------------------
# Module-level quiz views
# ---------------------------------------------------------------------------

class ModuleQuizListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, module_id):
        mod = get_object_or_404(ContentEntity, pk=module_id, entity_type=EntityType.MODULE)
        links = ContentStructure.objects.filter(
            parent_entity=mod,
            child_entity__entity_type=EntityType.QUIZ,
        ).select_related('child_entity').order_by('sort_order')
        data = []
        for link in links:
            qe = link.child_entity
            data.append({
                'id': qe.id,
                'title': qe.title,
                'description': qe.description or '',
                'is_published': qe.status_code == StatusCode.PUBLISHED,
                'created_at': qe.created_at,
            })
        return Response(data)

    def post(self, request, module_id):
        mod = get_object_or_404(ContentEntity, pk=module_id, entity_type=EntityType.MODULE)
        course = _find_course_for_child(mod)
        if course and not can_manage_entity(request.user, course):
            raise PermissionDenied()

        return _create_quiz_under_parent(request, mod, course)


def _create_quiz_under_parent(request, parent_entity, course_entity):
    from quizzes.models import QuizQuestion, QuizOption, QuizRewardRule

    data = request.data
    title = data.get('title', '').strip()
    if not title:
        return Response({'title': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

    quiz_entity = ContentEntity.objects.create(
        entity_type=EntityType.QUIZ,
        title=title,
        description=data.get('description', ''),
        owner=request.user,
        status_code=StatusCode.PUBLISHED if data.get('is_published', True) else StatusCode.DRAFT,
    )

    pass_pct = data.get('pass_percentage', 50)
    QuizContent.objects.create(entity=quiz_entity, pass_percentage=int(pass_pct))

    max_order = ContentStructure.objects.filter(parent_entity=parent_entity).count()
    ContentStructure.objects.create(
        parent_entity=parent_entity,
        child_entity=quiz_entity,
        sort_order=max_order,
    )

    r1 = int(data.get('reward_first_try', 10))
    r2 = int(data.get('reward_second_try', 8))
    r3 = int(data.get('reward_third_try', 5))
    r4 = int(data.get('reward_fourth_plus', 2))
    QuizRewardRule.objects.bulk_create([
        QuizRewardRule(quiz_entity=quiz_entity, attempt_from=1, attempt_to=1, points_awarded=r1),
        QuizRewardRule(quiz_entity=quiz_entity, attempt_from=2, attempt_to=2, points_awarded=r2),
        QuizRewardRule(quiz_entity=quiz_entity, attempt_from=3, attempt_to=3, points_awarded=r3),
        QuizRewardRule(quiz_entity=quiz_entity, attempt_from=4, attempt_to=None, points_awarded=r4),
    ])

    questions_data = data.get('questions', [])
    if isinstance(questions_data, str):
        import json
        try:
            questions_data = json.loads(questions_data)
        except (json.JSONDecodeError, TypeError):
            questions_data = []

    for q_order, q_data in enumerate(questions_data):
        options_data = q_data.get('options', [])
        question = QuizQuestion.objects.create(
            quiz_entity=quiz_entity,
            question_text=q_data.get('question_text', ''),
            marks=q_data.get('marks', 1),
            sort_order=q_data.get('sort_order', q_order),
        )
        for o_order, o_data in enumerate(options_data):
            QuizOption.objects.create(
                question=question,
                option_text=o_data.get('option_text', ''),
                is_correct=o_data.get('is_correct', False),
                sort_order=o_data.get('sort_order', o_order),
            )

    return Response({
        'id': quiz_entity.id,
        'title': quiz_entity.title,
        'description': quiz_entity.description or '',
        'is_published': quiz_entity.status_code == StatusCode.PUBLISHED,
        'pass_percentage': pass_pct,
        'created_at': quiz_entity.created_at,
    }, status=status.HTTP_201_CREATED)
