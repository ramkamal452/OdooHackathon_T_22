from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsInstructorOrAdmin, IsLearner, can_manage_entity
from content.models import AccessRuleCode, ContentEntity, EntityType, StatusCode

from .models import CourseMembership, EntityProgress, MembershipStatus, AccessMode
from .serializers import EnrollmentSerializer, MyEnrollmentSerializer


class CourseEnrollView(APIView):
    permission_classes = [IsAuthenticated, IsLearner]

    def post(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk, entity_type=EntityType.COURSE)
        if entity.status_code != StatusCode.PUBLISHED:
            return Response({'detail': 'Course is not available.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            settings_obj = entity.course_settings
        except Exception:
            settings_obj = None
        if settings_obj and settings_obj.access_rule_code != AccessRuleCode.OPEN:
            return Response(
                {'detail': 'Enrollment is not open for this course.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if CourseMembership.objects.filter(course_entity=entity, user=request.user).exists():
            return Response({'detail': 'Already enrolled.'}, status=status.HTTP_400_BAD_REQUEST)
        mem = CourseMembership.objects.create(
            course_entity=entity,
            user=request.user,
            membership_status=MembershipStatus.ACTIVE,
            access_mode=AccessMode.OPEN,
            enrolled_at=timezone.now(),
        )
        data = EnrollmentSerializer.from_membership(mem, request)
        return Response(data, status=status.HTTP_201_CREATED)


class CourseInviteView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def post(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk, entity_type=EntityType.COURSE)
        if not can_manage_entity(request.user, entity):
            raise PermissionDenied()
        email = request.data.get('email', '').strip()
        if not email:
            return Response({'email': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)
        from accounts.models import User
        target_user = User.objects.filter(email__iexact=email).first()
        if target_user and CourseMembership.objects.filter(course_entity=entity, user=target_user).exists():
            return Response({'detail': 'User already enrolled.'}, status=status.HTTP_400_BAD_REQUEST)

        mem = CourseMembership(
            course_entity=entity,
            invited_email=email,
            invited_by=request.user,
            membership_status=MembershipStatus.INVITED,
            access_mode=AccessMode.INVITATION,
            invited_at=timezone.now(),
        )
        if target_user:
            mem.user = target_user
            mem.membership_status = MembershipStatus.ACTIVE
            mem.enrolled_at = timezone.now()
        mem.generate_invite_token()
        mem.save()
        return Response({'detail': 'Invitation sent.', 'id': mem.id}, status=status.HTTP_201_CREATED)


class InviteAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get('token', '')
        if not token:
            return Response({'detail': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            membership = CourseMembership.objects.get(invite_token=token)
        except CourseMembership.DoesNotExist:
            return Response({'detail': 'Invalid or expired invitation.'}, status=status.HTTP_404_NOT_FOUND)
        if membership.user and membership.user != request.user:
            return Response({'detail': 'This invitation is for another user.'}, status=status.HTTP_403_FORBIDDEN)
        membership.user = request.user
        membership.membership_status = MembershipStatus.ACTIVE
        membership.enrolled_at = timezone.now()
        membership.save()
        return Response({'detail': 'Invitation accepted. You are now enrolled.'})


class CourseEnrollmentListView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk, entity_type=EntityType.COURSE)
        if not can_manage_entity(request.user, entity):
            raise PermissionDenied()
        mems = CourseMembership.objects.filter(
            course_entity=entity,
        ).select_related('course_entity', 'user').order_by('-enrolled_at')
        data = [EnrollmentSerializer.from_membership(m, request) for m in mems]
        return Response(data)


class MyEnrollmentsView(APIView):
    permission_classes = [IsAuthenticated, IsLearner]

    def get(self, request):
        mems = CourseMembership.objects.filter(
            user=request.user,
            membership_status__in=[MembershipStatus.ACTIVE, MembershipStatus.COMPLETED],
            course_entity__deleted_at__isnull=True,
        ).select_related('course_entity')
        data = [MyEnrollmentSerializer.from_membership(m) for m in mems]
        return Response(data)


class InstructorDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request):
        user = request.user
        role = getattr(user, 'role', None)
        if role == 'admin':
            courses = ContentEntity.objects.filter(entity_type=EntityType.COURSE, deleted_at__isnull=True)
        else:
            courses = ContentEntity.objects.filter(entity_type=EntityType.COURSE, owner=user, deleted_at__isnull=True)
        course_ids = list(courses.values_list('id', flat=True))
        enrollments = CourseMembership.objects.filter(course_entity_id__in=course_ids)
        total_courses = courses.count()
        total_enrollments = enrollments.count()
        total_completed = enrollments.filter(membership_status=MembershipStatus.COMPLETED).count()
        total_in_progress = enrollments.filter(membership_status=MembershipStatus.ACTIVE, started_at__isnull=False).count()

        course_rows = []
        for c in courses:
            ec = enrollments.filter(course_entity=c).count()
            cc = enrollments.filter(course_entity=c, membership_status=MembershipStatus.COMPLETED).count()
            from content.serializers import STATUS_MAP
            course_rows.append({
                'id': c.id,
                'title': c.title,
                'status': STATUS_MAP.get(c.status_code, 'draft'),
                'enrollment_count': ec,
                'completion_count': cc,
            })
        return Response({
            'total_courses': total_courses,
            'total_enrollments': total_enrollments,
            'total_completed': total_completed,
            'total_in_progress': total_in_progress,
            'courses': course_rows,
        })


class LearnerDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsLearner]

    def get(self, request):
        mems = CourseMembership.objects.filter(
            user=request.user,
            membership_status__in=[MembershipStatus.ACTIVE, MembershipStatus.COMPLETED],
            course_entity__deleted_at__isnull=True,
        ).select_related('course_entity')
        enrolled_courses = mems.count()
        in_progress = mems.filter(membership_status=MembershipStatus.ACTIVE, started_at__isnull=False).count()
        completed = mems.filter(membership_status=MembershipStatus.COMPLETED).count()
        total_points = request.user.points

        from content.models import EntityTag
        course_ids = [m.course_entity_id for m in mems]
        tags_map: dict[int, str] = {}
        for et in EntityTag.objects.filter(entity_id__in=course_ids).select_related('tag'):
            tags_map.setdefault(et.entity_id, []).append(et.tag.name)

        enrollment_data = []
        for m in mems:
            status_str = 'yet_to_start'
            if m.membership_status == MembershipStatus.COMPLETED:
                status_str = 'completed'
            elif m.started_at:
                status_str = 'in_progress'
            tag_names = tags_map.get(m.course_entity_id, [])
            enrollment_data.append({
                'course_id': m.course_entity_id,
                'course_title': m.course_entity.title,
                'status': status_str,
                'progress_percent': m.progress_percent,
                'tags': ', '.join(tag_names) if tag_names else '',
            })
        return Response({
            'enrolled_courses': enrolled_courses,
            'in_progress': in_progress,
            'completed': completed,
            'total_points': total_points,
            'enrollments': enrollment_data,
        })


class AdminEnrollmentListView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request):
        qs = CourseMembership.objects.select_related(
            'user', 'course_entity',
        ).order_by('-enrolled_at')

        search = request.query_params.get('search')
        status_param = request.query_params.get('status')
        course_id = request.query_params.get('course')
        if search:
            qs = qs.filter(Q(user__email__icontains=search) | Q(course_entity__title__icontains=search))
        if status_param:
            smap = {'yet_to_start': MembershipStatus.ACTIVE, 'in_progress': MembershipStatus.ACTIVE, 'completed': MembershipStatus.COMPLETED}
            code = smap.get(status_param)
            if code:
                qs = qs.filter(membership_status=code)
                if status_param == 'in_progress':
                    qs = qs.filter(started_at__isnull=False)
                elif status_param == 'yet_to_start':
                    qs = qs.filter(started_at__isnull=True)
        if course_id:
            qs = qs.filter(course_entity_id=course_id)

        paginator = PageNumberPagination()
        paginator.page_size = request.query_params.get('page_size', 10)
        page = paginator.paginate_queryset(qs, request)

        results = []
        for m in (page or qs):
            u = m.user
            status_str = 'yet_to_start'
            if m.membership_status == MembershipStatus.COMPLETED:
                status_str = 'completed'
            elif m.started_at:
                status_str = 'in_progress'
            results.append({
                'id': m.id,
                'learner_name': (u.get_full_name() or '').strip() or u.email if u else m.invited_email,
                'learner_email': u.email if u else m.invited_email,
                'course_title': m.course_entity.title,
                'status': status_str,
                'progress_percent': m.progress_percent,
                'time_spent_seconds': m.time_spent_seconds,
                'enrolled_at': m.enrolled_at,
                'completed_at': m.completed_at,
                'started_at': m.started_at,
            })
        if page is not None:
            return paginator.get_paginated_response(results)
        return Response(results)


class AdminLessonProgressListView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request):
        from enrollment.models import ProgressStatus
        from content.models import ContentStructure, EntityType as ET

        qs = EntityProgress.objects.select_related(
            'learner', 'entity',
        ).order_by('-last_accessed_at', '-id')

        search = request.query_params.get('search')
        is_completed_raw = request.query_params.get('is_completed')
        if search:
            qs = qs.filter(Q(learner__email__icontains=search) | Q(entity__title__icontains=search))
        if is_completed_raw == 'true':
            qs = qs.filter(progress_status=ProgressStatus.COMPLETED)
        elif is_completed_raw == 'false':
            qs = qs.exclude(progress_status=ProgressStatus.COMPLETED)

        paginator = PageNumberPagination()
        paginator.page_size = request.query_params.get('page_size', 10)
        page = paginator.paginate_queryset(qs, request)

        results = []
        for p in (page or qs):
            u = p.learner
            course_title = ''
            parent_link = ContentStructure.objects.filter(child_entity=p.entity).select_related('parent_entity').first()
            if parent_link:
                par = parent_link.parent_entity
                if par.entity_type == ET.MODULE:
                    gp = ContentStructure.objects.filter(child_entity=par).select_related('parent_entity').first()
                    course_title = gp.parent_entity.title if gp else par.title
                else:
                    course_title = par.title

            results.append({
                'id': p.id,
                'learner_name': (u.get_full_name() or '').strip() or u.email,
                'learner_email': u.email,
                'lesson_title': p.entity.title,
                'course_title': course_title,
                'is_completed': p.progress_status == ProgressStatus.COMPLETED,
                'completed_at': p.completed_at,
                'last_viewed_at': p.last_accessed_at,
            })
        if page is not None:
            return paginator.get_paginated_response(results)
        return Response(results)
