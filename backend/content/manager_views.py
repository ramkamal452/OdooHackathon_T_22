"""
Unified Content Manager API — fully flexible tree-based CRUD for all entity types.
Supports standalone or nested creation of courses, modules, lessons, quizzes, videos, resources.
"""
import json

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsInstructorOrAdmin
from assets.models import Asset

from .models import (
    ContentAttachment,
    ContentEntity,
    ContentStructure,
    EntityType,
    LessonContent,
    QuizContent,
    ResourceContent,
    ResourceKind,
    StatusCode,
    VideoContent,
)


def _parse_bool(val, default=False):
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ('true', '1', 'yes', 'on')
    return default


def _upload_file(file_obj, user):
    return Asset.upload_file(file_obj, user=user)


ENTITY_TYPE_MAP = {
    'course': EntityType.COURSE,
    'module': EntityType.MODULE,
    'lesson': EntityType.LESSON,
    'video': EntityType.VIDEO,
    'quiz': EntityType.QUIZ,
    'article': EntityType.ARTICLE,
    'resource': EntityType.RESOURCE,
}

TYPE_LABELS = {v: k for k, v in ENTITY_TYPE_MAP.items()}

CONTAINER_TYPES = {EntityType.COURSE, EntityType.MODULE, EntityType.LESSON}


def _type_label(entity):
    return TYPE_LABELS.get(entity.entity_type, 'unknown')


def _serialize_entity(entity, include_children=False, depth=0, max_depth=6):
    data = {
        'id': entity.id,
        'entity_type': _type_label(entity),
        'entity_type_code': entity.entity_type,
        'title': entity.title,
        'description': entity.description or '',
        'short_description': entity.short_description or '',
        'status': entity.status_code,
        'created_at': entity.created_at.isoformat() if entity.created_at else None,
    }

    if entity.entity_type == EntityType.VIDEO:
        try:
            vd = entity.video_detail
            data['video_url'] = vd.video_url or ''
            data['duration_seconds'] = vd.duration_seconds
            data['allow_download'] = vd.allow_download
        except VideoContent.DoesNotExist:
            data['video_url'] = ''

    elif entity.entity_type == EntityType.RESOURCE:
        try:
            rd = entity.resource_detail
            data['resource_url'] = rd.resource_url or ''
            data['resource_kind'] = rd.resource_kind
            if rd.asset_id:
                data['file_url'] = rd.asset.url
        except ResourceContent.DoesNotExist:
            data['resource_url'] = ''

    elif entity.entity_type == EntityType.LESSON:
        try:
            ld = entity.lesson_detail
            data['body'] = ld.body or ''
        except LessonContent.DoesNotExist:
            data['body'] = ''

    elif entity.entity_type == EntityType.QUIZ:
        try:
            qd = entity.quiz_detail
            data['pass_percentage'] = qd.pass_percentage
        except QuizContent.DoesNotExist:
            data['pass_percentage'] = 50
        data['questions'] = _serialize_quiz_questions(entity)

    atts = ContentAttachment.objects.filter(entity=entity).order_by('sort_order')
    data['attachments'] = [
        {
            'id': a.id,
            'title': a.title,
            'file_url': a.asset.url if a.asset_id else '',
            'external_url': a.external_url or '',
        }
        for a in atts
    ]

    if include_children and depth < max_depth:
        links = (
            ContentStructure.objects.filter(parent_entity=entity)
            .select_related('child_entity')
            .order_by('sort_order')
        )
        children = []
        for link in links:
            child_data = _serialize_entity(link.child_entity, True, depth + 1, max_depth)
            child_data['sort_order'] = link.sort_order
            child_data['is_preview'] = link.is_preview
            child_data['link_id'] = link.id
            children.append(child_data)
        data['children'] = children
    else:
        data['children_count'] = ContentStructure.objects.filter(parent_entity=entity).count()

    return data


def _serialize_quiz_questions(entity):
    from quizzes.models import QuizQuestion
    questions = QuizQuestion.objects.filter(quiz_entity=entity).order_by('sort_order')
    result = []
    for q in questions:
        opts = q.options.all().order_by('sort_order')
        result.append({
            'id': q.id,
            'question_text': q.question_text,
            'marks': q.marks,
            'sort_order': q.sort_order,
            'options': [
                {'id': o.id, 'option_text': o.option_text, 'is_correct': o.is_correct, 'sort_order': o.sort_order}
                for o in opts
            ],
        })
    return result


def _create_entity_detail(entity, data, files, user):
    """Create type-specific detail records and handle file uploads."""
    file_obj = files.get('file') if files else None

    if entity.entity_type == EntityType.VIDEO:
        video_url = data.get('video_url', '')
        video_asset = None
        if file_obj:
            asset = _upload_file(file_obj, user)
            video_url = asset.url
            video_asset = asset
        VideoContent.objects.create(
            entity=entity,
            video_url=video_url,
            video_asset=video_asset,
            allow_download=_parse_bool(data.get('allow_download', False)),
            duration_seconds=int(data.get('duration_seconds', 0) or 0),
        )

    elif entity.entity_type == EntityType.RESOURCE:
        resource_url = data.get('resource_url', '')
        asset_fk = None
        if file_obj:
            asset = _upload_file(file_obj, user)
            resource_url = asset.url
            asset_fk = asset
        rk_str = str(data.get('resource_kind', '4'))
        try:
            rk = int(rk_str)
        except (ValueError, TypeError):
            rk = ResourceKind.ATTACHMENT
        ResourceContent.objects.create(
            entity=entity,
            resource_url=resource_url,
            resource_kind=rk,
            allow_download=_parse_bool(data.get('allow_download', False)),
            asset=asset_fk,
        )

    elif entity.entity_type == EntityType.LESSON:
        LessonContent.objects.create(entity=entity, body=data.get('body', ''))
        if file_obj:
            asset = _upload_file(file_obj, user)
            ContentAttachment.objects.create(
                entity=entity,
                title=file_obj.name,
                asset=asset,
                sort_order=0,
            )

    elif entity.entity_type == EntityType.QUIZ:
        pass_pct = int(data.get('pass_percentage', 50) or 50)
        QuizContent.objects.create(entity=entity, pass_percentage=pass_pct)
        _save_quiz_questions(entity, data)


def _update_entity_detail(entity, data, files, user):
    file_obj = files.get('file') if files else None

    if entity.entity_type == EntityType.VIDEO:
        vd, _ = VideoContent.objects.get_or_create(entity=entity)
        if file_obj:
            old_asset = vd.video_asset
            asset = _upload_file(file_obj, user)
            vd.video_url = asset.url
            vd.video_asset = asset
            vd.save()
            if old_asset:
                old_asset.delete()
        else:
            if 'video_url' in data:
                vd.video_url = data['video_url']
        if 'allow_download' in data:
            vd.allow_download = _parse_bool(data['allow_download'])
        if 'duration_seconds' in data:
            vd.duration_seconds = int(data['duration_seconds'] or 0)
        vd.save()

    elif entity.entity_type == EntityType.RESOURCE:
        rd, _ = ResourceContent.objects.get_or_create(entity=entity)
        if file_obj:
            old_asset = rd.asset
            asset = _upload_file(file_obj, user)
            rd.resource_url = asset.url
            rd.asset = asset
            rd.save()
            if old_asset:
                old_asset.delete()
        elif 'resource_url' in data:
            rd.resource_url = data['resource_url']
        if 'resource_kind' in data:
            try:
                rd.resource_kind = int(data['resource_kind'])
            except (ValueError, TypeError):
                pass
        if 'allow_download' in data:
            rd.allow_download = _parse_bool(data['allow_download'])
        rd.save()

    elif entity.entity_type == EntityType.LESSON:
        ld, _ = LessonContent.objects.get_or_create(entity=entity)
        if 'body' in data:
            ld.body = data['body']
            ld.save()
        if file_obj:
            asset = _upload_file(file_obj, user)
            ContentAttachment.objects.create(
                entity=entity, title=file_obj.name, asset=asset,
                sort_order=ContentAttachment.objects.filter(entity=entity).count(),
            )

    elif entity.entity_type == EntityType.QUIZ:
        qd, _ = QuizContent.objects.get_or_create(entity=entity)
        if 'pass_percentage' in data:
            qd.pass_percentage = int(data['pass_percentage'] or 50)
            qd.save()
        if 'questions' in data:
            _save_quiz_questions(entity, data)


def _save_quiz_questions(entity, data):
    from quizzes.models import QuizOption, QuizQuestion, QuizRewardRule

    questions_data = data.get('questions', [])
    if isinstance(questions_data, str):
        try:
            questions_data = json.loads(questions_data)
        except (json.JSONDecodeError, TypeError):
            questions_data = []
    if not questions_data:
        return

    entity.quiz_questions.all().delete()

    for q_order, q_data in enumerate(questions_data):
        question = QuizQuestion.objects.create(
            quiz_entity=entity,
            question_text=q_data.get('question_text', ''),
            marks=int(q_data.get('marks', 1) or 1),
            sort_order=q_data.get('sort_order', q_order),
        )
        for o_order, o_data in enumerate(q_data.get('options', [])):
            QuizOption.objects.create(
                question=question,
                option_text=o_data.get('option_text', ''),
                is_correct=_parse_bool(o_data.get('is_correct', False)),
                sort_order=o_data.get('sort_order', o_order),
            )

    if not QuizRewardRule.objects.filter(quiz_entity=entity).exists():
        QuizRewardRule.objects.bulk_create([
            QuizRewardRule(quiz_entity=entity, attempt_from=1, attempt_to=1, points_awarded=10),
            QuizRewardRule(quiz_entity=entity, attempt_from=2, attempt_to=2, points_awarded=8),
            QuizRewardRule(quiz_entity=entity, attempt_from=3, attempt_to=3, points_awarded=5),
            QuizRewardRule(quiz_entity=entity, attempt_from=4, attempt_to=None, points_awarded=2),
        ])


class ContentTreeView(APIView):
    """GET — return the full content tree for the current user.
    Query params: ?root_id=X (optional, filter to one tree), ?type=course (optional).
    """
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request):
        root_id = request.query_params.get('root_id')
        etype = request.query_params.get('type')
        is_admin = getattr(request.user, 'role', None) == 'admin'

        qs = ContentEntity.objects.all() if is_admin else ContentEntity.objects.filter(owner=request.user)
        if root_id:
            entity = get_object_or_404(ContentEntity, pk=root_id)
            return Response(_serialize_entity(entity, include_children=True))

        if etype and etype in ENTITY_TYPE_MAP:
            qs = qs.filter(entity_type=ENTITY_TYPE_MAP[etype])

        child_filter = ContentStructure.objects.all() if is_admin else ContentStructure.objects.filter(child_entity__owner=request.user)
        top_level_ids = set(child_filter.values_list('child_entity_id', flat=True))
        roots = qs.exclude(id__in=top_level_ids).order_by('-created_at')[:200]

        return Response([_serialize_entity(e, include_children=True) for e in roots])


class EntityCreateView(APIView):
    """POST — create any content entity. Accepts FormData or JSON.
    Fields: entity_type (str), title, description, parent_id (opt), file (opt), + type-specific.
    """
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        data = request.data
        type_str = data.get('entity_type', '').lower().strip()
        if type_str not in ENTITY_TYPE_MAP:
            return Response(
                {'entity_type': [f'Must be one of: {", ".join(ENTITY_TYPE_MAP.keys())}']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        etype = ENTITY_TYPE_MAP[type_str]
        title = (data.get('title') or '').strip()
        if not title:
            return Response({'title': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

        entity = ContentEntity.objects.create(
            entity_type=etype,
            title=title,
            description=data.get('description', ''),
            short_description=data.get('short_description', ''),
            owner=request.user,
            status_code=StatusCode.PUBLISHED if _parse_bool(data.get('is_published', True)) else StatusCode.DRAFT,
        )

        _create_entity_detail(entity, data, request.FILES, request.user)

        parent_id = data.get('parent_id')
        if parent_id:
            try:
                parent = ContentEntity.objects.get(pk=int(parent_id))
                max_order = ContentStructure.objects.filter(parent_entity=parent).count()
                ContentStructure.objects.create(
                    parent_entity=parent,
                    child_entity=entity,
                    sort_order=int(data.get('sort_order', max_order)),
                    is_preview=_parse_bool(data.get('is_preview', False)),
                )
            except (ContentEntity.DoesNotExist, ValueError):
                pass

        return Response(_serialize_entity(entity, include_children=True), status=status.HTTP_201_CREATED)


class EntityDetailView(APIView):
    """GET/PUT/DELETE a single entity."""
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk)
        return Response(_serialize_entity(entity, include_children=True))

    def put(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk)
        data = request.data

        if 'title' in data:
            entity.title = data['title']
        if 'description' in data:
            entity.description = data['description']
        if 'short_description' in data:
            entity.short_description = data['short_description']
        if 'is_published' in data:
            entity.status_code = StatusCode.PUBLISHED if _parse_bool(data['is_published']) else StatusCode.DRAFT
        entity.save()

        _update_entity_detail(entity, data, request.FILES, request.user)

        link = ContentStructure.objects.filter(child_entity=entity).first()
        if link:
            if 'sort_order' in data:
                link.sort_order = int(data['sort_order'])
            if 'is_preview' in data:
                link.is_preview = _parse_bool(data['is_preview'])
            link.save()

        return Response(_serialize_entity(entity, include_children=True))

    def delete(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk)
        # Clean up associated assets before deletion
        if entity.entity_type == EntityType.VIDEO:
            try:
                vd = entity.video_detail
                if vd.video_asset:
                    vd.video_asset.delete()
            except Exception:
                pass
        elif entity.entity_type == EntityType.RESOURCE:
            try:
                rd = entity.resource_detail
                if rd.asset:
                    rd.asset.delete()
            except Exception:
                pass
        # Clean up attachments
        for att in entity.attachments.all():
            if att.asset:
                att.asset.delete()
        entity.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EntityChildrenView(APIView):
    """GET children / POST to add a child (create new or attach existing)."""
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk)
        links = (
            ContentStructure.objects.filter(parent_entity=entity)
            .select_related('child_entity')
            .order_by('sort_order')
        )
        result = []
        for link in links:
            child_data = _serialize_entity(link.child_entity, include_children=True)
            child_data['sort_order'] = link.sort_order
            child_data['is_preview'] = link.is_preview
            child_data['link_id'] = link.id
            result.append(child_data)
        return Response(result)

    def post(self, request, pk):
        parent = get_object_or_404(ContentEntity, pk=pk)
        data = request.data

        existing_id = data.get('existing_child_id')
        if existing_id:
            child = get_object_or_404(ContentEntity, pk=int(existing_id))
            if ContentStructure.objects.filter(parent_entity=parent, child_entity=child).exists():
                return Response({'detail': 'Already a child.'}, status=status.HTTP_400_BAD_REQUEST)
            max_order = ContentStructure.objects.filter(parent_entity=parent).count()
            ContentStructure.objects.create(
                parent_entity=parent,
                child_entity=child,
                sort_order=int(data.get('sort_order', max_order)),
                is_preview=_parse_bool(data.get('is_preview', False)),
            )
            return Response(_serialize_entity(child, include_children=True), status=status.HTTP_201_CREATED)

        type_str = data.get('entity_type', '').lower().strip()
        if type_str not in ENTITY_TYPE_MAP:
            return Response(
                {'entity_type': [f'Must be one of: {", ".join(ENTITY_TYPE_MAP.keys())}']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        etype = ENTITY_TYPE_MAP[type_str]
        title = (data.get('title') or '').strip()
        if not title:
            return Response({'title': ['Required.']}, status=status.HTTP_400_BAD_REQUEST)

        child = ContentEntity.objects.create(
            entity_type=etype,
            title=title,
            description=data.get('description', ''),
            owner=request.user,
            status_code=StatusCode.PUBLISHED if _parse_bool(data.get('is_published', True)) else StatusCode.DRAFT,
        )
        _create_entity_detail(child, data, request.FILES, request.user)

        max_order = ContentStructure.objects.filter(parent_entity=parent).count()
        ContentStructure.objects.create(
            parent_entity=parent,
            child_entity=child,
            sort_order=int(data.get('sort_order', max_order)),
            is_preview=_parse_bool(data.get('is_preview', False)),
        )

        return Response(_serialize_entity(child, include_children=True), status=status.HTTP_201_CREATED)


class EntityChildRemoveView(APIView):
    """DELETE — detach a child from parent (does NOT delete the child entity)."""
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def delete(self, request, pk, child_id):
        link = ContentStructure.objects.filter(parent_entity_id=pk, child_entity_id=child_id).first()
        if link:
            link.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EntityUploadView(APIView):
    """POST — upload a file as attachment to any entity."""
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk)
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'file': ['No file provided.']}, status=status.HTTP_400_BAD_REQUEST)

        asset = _upload_file(file_obj, request.user)
        title = request.data.get('title', '') or file_obj.name
        max_order = ContentAttachment.objects.filter(entity=entity).count()
        att = ContentAttachment.objects.create(
            entity=entity,
            title=title,
            asset=asset,
            sort_order=max_order,
        )
        return Response({
            'id': att.id,
            'title': att.title,
            'file_url': asset.url,
        }, status=status.HTTP_201_CREATED)


class EntityAttachmentDeleteView(APIView):
    """DELETE — remove an attachment."""
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def delete(self, request, pk):
        att = get_object_or_404(ContentAttachment, pk=pk)
        if att.asset:
            att.asset.delete()
        att.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StandaloneEntitiesView(APIView):
    """GET — list all entities of a given type that have no parent (standalone).
    Query: ?type=module|lesson|quiz|video|resource
    """
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request):
        etype = request.query_params.get('type', '').lower()
        if etype not in ENTITY_TYPE_MAP:
            return Response(
                {'type': [f'Must be one of: {", ".join(ENTITY_TYPE_MAP.keys())}']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        child_ids = set(
            ContentStructure.objects.values_list('child_entity_id', flat=True)
        )
        qs = ContentEntity.objects.filter(
            owner=request.user,
            entity_type=ENTITY_TYPE_MAP[etype],
        ).exclude(id__in=child_ids).order_by('-created_at')

        return Response([_serialize_entity(e, include_children=False) for e in qs[:200]])


class ReorderChildrenView(APIView):
    """PUT — reorder children. Body: { "order": [child_id, child_id, ...] }"""
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def put(self, request, pk):
        parent = get_object_or_404(ContentEntity, pk=pk)
        order = request.data.get('order', [])
        if isinstance(order, str):
            try:
                order = json.loads(order)
            except (json.JSONDecodeError, TypeError):
                order = []

        for idx, child_id in enumerate(order):
            ContentStructure.objects.filter(
                parent_entity=parent, child_entity_id=int(child_id)
            ).update(sort_order=idx)

        return Response({'status': 'ok'})
