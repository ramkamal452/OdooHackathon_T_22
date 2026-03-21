from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsInstructorOrAdmin, IsLearner, can_manage_entity, learner_has_membership
from accounts.serializers import BriefUserSerializer
from content.models import (
    ContentEntity,
    ContentStructure,
    EntityType,
    QuizContent,
    StatusCode,
)

from .models import QuizAttempt, QuizAttemptAnswer, QuizOption, QuizQuestion, QuizRewardRule
from .serializers import (
    AdminQuizAnswerListSerializer,
    AdminQuizAttemptListSerializer,
    AdminQuizOptionListSerializer,
    AdminQuizQuestionListSerializer,
    QuizAttemptResultSerializer,
    QuizAttemptSubmitSerializer,
    QuizOptionSerializer,
    QuizQuestionSerializer,
    QuizWriteSerializer,
)


def _get_quiz_entity(pk):
    return get_object_or_404(
        ContentEntity.objects.select_related('owner'),
        pk=pk, entity_type=EntityType.QUIZ,
    )


def _find_course_for_quiz(quiz_entity):
    link = ContentStructure.objects.filter(child_entity=quiz_entity).select_related('parent_entity').first()
    if not link:
        return None
    parent = link.parent_entity
    if parent.entity_type == EntityType.COURSE:
        return parent
    if parent.entity_type == EntityType.MODULE:
        gp = ContentStructure.objects.filter(child_entity=parent).select_related('parent_entity').first()
        return gp.parent_entity if gp else None
    return None


def _reward_fields(quiz_entity):
    rules = list(QuizRewardRule.objects.filter(quiz_entity=quiz_entity).order_by('attempt_from'))
    r1, r2, r3, r4 = 10, 8, 5, 2
    for rule in rules:
        if rule.attempt_from == 1 and (rule.attempt_to is None or rule.attempt_to == 1):
            r1 = rule.points_awarded
        elif rule.attempt_from == 2 and (rule.attempt_to is None or rule.attempt_to == 2):
            r2 = rule.points_awarded
        elif rule.attempt_from == 3 and (rule.attempt_to is None or rule.attempt_to == 3):
            r3 = rule.points_awarded
        elif rule.attempt_from >= 4:
            r4 = rule.points_awarded
    return r1, r2, r3, r4


def _quiz_list_item(quiz_entity, course_entity=None, module_entity=None, question_count=None):
    r1, r2, r3, r4 = _reward_fields(quiz_entity)
    qc = question_count
    if qc is None:
        qc = QuizQuestion.objects.filter(quiz_entity=quiz_entity, is_active=True).count()
    is_published = quiz_entity.status_code == StatusCode.PUBLISHED
    try:
        qd = quiz_entity.quiz_detail
        pass_pct = qd.pass_percentage
    except QuizContent.DoesNotExist:
        pass_pct = 50

    course_id = None
    module_id = None
    if course_entity:
        course_id = course_entity.id
    if module_entity:
        module_id = module_entity.id

    return {
        'id': quiz_entity.id,
        'title': quiz_entity.title,
        'description': quiz_entity.description or '',
        'question_count': qc,
        'course_id': course_id,
        'module_id': module_id,
        'pass_percentage': pass_pct,
        'is_published': is_published,
        'reward_first_try': r1,
        'reward_second_try': r2,
        'reward_third_try': r3,
        'reward_fourth_plus': r4,
        'created_at': quiz_entity.created_at,
    }


def _quiz_detail_item(quiz_entity, request=None):
    course = _find_course_for_quiz(quiz_entity)
    link = ContentStructure.objects.filter(child_entity=quiz_entity).first()
    module = None
    if link and link.parent_entity.entity_type == EntityType.MODULE:
        module = link.parent_entity

    r1, r2, r3, r4 = _reward_fields(quiz_entity)
    try:
        qd = quiz_entity.quiz_detail
        pass_pct = qd.pass_percentage
    except QuizContent.DoesNotExist:
        pass_pct = 50

    questions = QuizQuestion.objects.filter(
        quiz_entity=quiz_entity, is_active=True,
    ).prefetch_related('options').order_by('sort_order', 'id')
    questions_data = QuizQuestionSerializer(
        questions, many=True, context={'request': request},
    ).data

    return {
        'id': quiz_entity.id,
        'course': {'id': course.id, 'title': course.title, 'slug': course.slug} if course else None,
        'module': {'id': module.id, 'title': module.title, 'sort_order': 0} if module else None,
        'title': quiz_entity.title,
        'description': quiz_entity.description or '',
        'pass_percentage': pass_pct,
        'is_published': quiz_entity.status_code == StatusCode.PUBLISHED,
        'reward_first_try': r1,
        'reward_second_try': r2,
        'reward_third_try': r3,
        'reward_fourth_plus': r4,
        'created_at': quiz_entity.created_at,
        'questions': questions_data,
    }


# ---------------------------------------------------------------------------
# Quiz list/create (under course)
# ---------------------------------------------------------------------------

class QuizListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        course = get_object_or_404(ContentEntity, pk=course_id, entity_type=EntityType.COURSE)
        is_manager = can_manage_entity(request.user, course)
        if not is_manager and not learner_has_membership(request.user, course):
            raise NotFound()

        quiz_ids = set()
        direct = ContentStructure.objects.filter(
            parent_entity=course, child_entity__entity_type=EntityType.QUIZ,
        ).values_list('child_entity_id', flat=True)
        quiz_ids.update(direct)

        module_ids = ContentStructure.objects.filter(
            parent_entity=course, child_entity__entity_type=EntityType.MODULE,
        ).values_list('child_entity_id', flat=True)
        nested = ContentStructure.objects.filter(
            parent_entity_id__in=module_ids, child_entity__entity_type=EntityType.QUIZ,
        ).values_list('child_entity_id', flat=True)
        quiz_ids.update(nested)

        quizzes = ContentEntity.objects.filter(id__in=quiz_ids).order_by('-created_at')
        if not is_manager:
            quizzes = quizzes.filter(status_code=StatusCode.PUBLISHED)

        data = [_quiz_list_item(q, course_entity=course) for q in quizzes]
        return Response(data)

    def post(self, request, course_id):
        course = get_object_or_404(ContentEntity, pk=course_id, entity_type=EntityType.COURSE)
        if not can_manage_entity(request.user, course):
            raise PermissionDenied()

        ser = QuizWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        vd = ser.validated_data

        quiz_entity = ContentEntity.objects.create(
            entity_type=EntityType.QUIZ,
            title=vd['title'],
            description=vd.get('description', ''),
            owner=request.user,
            status_code=StatusCode.PUBLISHED if vd.get('is_published') else StatusCode.DRAFT,
        )

        QuizContent.objects.create(
            entity=quiz_entity,
            pass_percentage=vd.get('pass_percentage', 50),
        )

        module_id = vd.get('module')
        parent = course
        if module_id:
            mod = ContentEntity.objects.filter(pk=module_id, entity_type=EntityType.MODULE).first()
            if mod and ContentStructure.objects.filter(parent_entity=course, child_entity=mod).exists():
                parent = mod

        max_order = ContentStructure.objects.filter(parent_entity=parent).count()
        ContentStructure.objects.create(parent_entity=parent, child_entity=quiz_entity, sort_order=max_order)

        r1 = vd.get('reward_first_try', 10)
        r2 = vd.get('reward_second_try', 8)
        r3 = vd.get('reward_third_try', 5)
        r4 = vd.get('reward_fourth_plus', 2)
        QuizRewardRule.objects.bulk_create([
            QuizRewardRule(quiz_entity=quiz_entity, attempt_from=1, attempt_to=1, points_awarded=r1),
            QuizRewardRule(quiz_entity=quiz_entity, attempt_from=2, attempt_to=2, points_awarded=r2),
            QuizRewardRule(quiz_entity=quiz_entity, attempt_from=3, attempt_to=3, points_awarded=r3),
            QuizRewardRule(quiz_entity=quiz_entity, attempt_from=4, attempt_to=None, points_awarded=r4),
        ])

        for q_order, q_data in enumerate(vd.get('questions', [])):
            options_data = q_data.pop('options', [])
            question = QuizQuestion.objects.create(
                quiz_entity=quiz_entity,
                question_text=q_data['question_text'],
                marks=q_data.get('marks', 1),
                sort_order=q_data.get('sort_order', q_order),
            )
            for o_order, o_data in enumerate(options_data):
                QuizOption.objects.create(
                    question=question,
                    option_text=o_data['option_text'],
                    is_correct=o_data['is_correct'],
                    sort_order=o_data.get('sort_order', o_order),
                )

        return Response(_quiz_detail_item(quiz_entity, request), status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Quiz detail
# ---------------------------------------------------------------------------

class QuizDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        quiz_entity = _get_quiz_entity(pk)
        course = _find_course_for_quiz(quiz_entity)
        is_manager = can_manage_entity(request.user, quiz_entity) or (course and can_manage_entity(request.user, course))
        if not is_manager:
            if course and not learner_has_membership(request.user, course):
                raise NotFound()
            if quiz_entity.status_code != StatusCode.PUBLISHED:
                raise NotFound()
        return Response(_quiz_detail_item(quiz_entity, request))

    def put(self, request, pk):
        return self._update(request, pk)

    def patch(self, request, pk):
        return self._update(request, pk)

    def _update(self, request, pk):
        quiz_entity = _get_quiz_entity(pk)
        course = _find_course_for_quiz(quiz_entity)
        if not can_manage_entity(request.user, quiz_entity) and not (course and can_manage_entity(request.user, course)):
            raise PermissionDenied()

        ser = QuizWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        vd = ser.validated_data

        quiz_entity.title = vd['title']
        quiz_entity.description = vd.get('description', '')
        quiz_entity.status_code = StatusCode.PUBLISHED if vd.get('is_published') else StatusCode.DRAFT
        quiz_entity.save()

        qc, _ = QuizContent.objects.get_or_create(entity=quiz_entity)
        qc.pass_percentage = vd.get('pass_percentage', 50)
        qc.save()

        QuizRewardRule.objects.filter(quiz_entity=quiz_entity).delete()
        QuizRewardRule.objects.bulk_create([
            QuizRewardRule(quiz_entity=quiz_entity, attempt_from=1, attempt_to=1, points_awarded=vd.get('reward_first_try', 10)),
            QuizRewardRule(quiz_entity=quiz_entity, attempt_from=2, attempt_to=2, points_awarded=vd.get('reward_second_try', 8)),
            QuizRewardRule(quiz_entity=quiz_entity, attempt_from=3, attempt_to=3, points_awarded=vd.get('reward_third_try', 5)),
            QuizRewardRule(quiz_entity=quiz_entity, attempt_from=4, attempt_to=None, points_awarded=vd.get('reward_fourth_plus', 2)),
        ])

        questions_data = vd.get('questions')
        if questions_data is not None:
            QuizQuestion.objects.filter(quiz_entity=quiz_entity).delete()
            for q_order, q_data in enumerate(questions_data):
                options_data = q_data.pop('options', [])
                question = QuizQuestion.objects.create(
                    quiz_entity=quiz_entity,
                    question_text=q_data['question_text'],
                    marks=q_data.get('marks', 1),
                    sort_order=q_data.get('sort_order', q_order),
                )
                for o_order, o_data in enumerate(options_data):
                    QuizOption.objects.create(
                        question=question,
                        option_text=o_data['option_text'],
                        is_correct=o_data['is_correct'],
                        sort_order=o_data.get('sort_order', o_order),
                    )

        return Response(_quiz_detail_item(quiz_entity, request))

    def delete(self, request, pk):
        quiz_entity = _get_quiz_entity(pk)
        course = _find_course_for_quiz(quiz_entity)
        if not can_manage_entity(request.user, quiz_entity) and not (course and can_manage_entity(request.user, course)):
            raise PermissionDenied()
        quiz_entity.deleted_at = timezone.now()
        quiz_entity.save(update_fields=['deleted_at'])
        ContentStructure.objects.filter(child_entity=quiz_entity).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Quiz attempt
# ---------------------------------------------------------------------------

class QuizAttemptSubmitView(APIView):
    permission_classes = [IsAuthenticated, IsLearner]

    def post(self, request, pk):
        quiz_entity = _get_quiz_entity(pk)
        course = _find_course_for_quiz(quiz_entity)
        if course and not learner_has_membership(request.user, course):
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if quiz_entity.status_code != StatusCode.PUBLISHED:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        ser = QuizAttemptSubmitSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        answers_in = ser.validated_data['answers']
        questions = list(QuizQuestion.objects.filter(quiz_entity=quiz_entity, is_active=True))
        question_ids = {q.id for q in questions}
        if len(answers_in) != len(question_ids):
            return Response({'detail': 'You must answer every question.'}, status=status.HTTP_400_BAD_REQUEST)

        submitted_q = set()
        for item in answers_in:
            qid = item['question_id']
            if qid in submitted_q:
                return Response({'detail': 'Invalid or duplicate questions.'}, status=status.HTTP_400_BAD_REQUEST)
            submitted_q.add(qid)
        if submitted_q != question_ids:
            return Response({'detail': 'Invalid or duplicate questions.'}, status=status.HTTP_400_BAD_REQUEST)

        total_marks = sum(q.marks for q in questions)
        if total_marks == 0:
            return Response({'detail': 'Quiz has no marks configured.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            qd = quiz_entity.quiz_detail
            pass_pct_threshold = qd.pass_percentage
        except QuizContent.DoesNotExist:
            pass_pct_threshold = 50

        score = 0
        now = timezone.now()
        with transaction.atomic():
            attempt_count = QuizAttempt.objects.filter(quiz_entity=quiz_entity, learner=request.user).count()
            attempt_number = attempt_count + 1
            already_passed = QuizAttempt.objects.filter(quiz_entity=quiz_entity, learner=request.user, is_passed=True).exists()

            attempt = QuizAttempt.objects.create(
                quiz_entity=quiz_entity,
                learner=request.user,
                score=0,
                max_score=total_marks,
                percentage=Decimal('0'),
                is_passed=False,
                attempt_no=attempt_number,
                points_earned=0,
            )

            for item in answers_in:
                qid = item['question_id']
                oid = item['option_id']
                question = next(q for q in questions if q.id == qid)
                option = get_object_or_404(QuizOption, pk=oid, question=question)
                is_correct = option.is_correct
                marks_awarded = question.marks if is_correct else 0
                score += marks_awarded
                QuizAttemptAnswer.objects.create(
                    attempt=attempt,
                    question=question,
                    selected_option=option,
                    is_correct=is_correct,
                    marks_awarded=marks_awarded,
                    answered_at=now,
                )

            pct = (Decimal(score) / Decimal(total_marks)) * Decimal(100)
            pct = pct.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            is_passed = pct >= Decimal(pass_pct_threshold)
            attempt.score = score
            attempt.percentage = pct
            attempt.is_passed = is_passed
            attempt.submitted_at = now

            points = 0
            if is_passed and not already_passed:
                r1, r2, r3, r4 = _reward_fields(quiz_entity)
                if attempt_number == 1:
                    points = r1
                elif attempt_number == 2:
                    points = r2
                elif attempt_number == 3:
                    points = r3
                else:
                    points = r4

                from gamification.models import SourceType, UserPointLedger
                UserPointLedger.award_points(
                    user=request.user,
                    points=points,
                    source_type=SourceType.QUIZ,
                    reason=f'Quiz passed: {quiz_entity.title}',
                    source_entity=quiz_entity,
                    source_attempt=attempt,
                )

            if is_passed:
                from enrollment.models import EntityProgress, ProgressStatus
                EntityProgress.objects.update_or_create(
                    learner=request.user,
                    entity=quiz_entity,
                    defaults={
                        'progress_status': ProgressStatus.COMPLETED,
                        'progress_percent': 100,
                        'completed_at': now,
                        'last_accessed_at': now,
                    }
                )
                # Recalculate course progress if applicable
                from content.views import _find_course_for_child
                course = _find_course_for_child(quiz_entity)
                if course:
                    from enrollment.models import CourseMembership
                    try:
                        membership = CourseMembership.objects.get(course_entity=course, user=request.user)
                        membership.recalculate_progress()
                    except CourseMembership.DoesNotExist:
                        pass

            attempt.points_earned = points
            attempt.save(update_fields=[
                'score', 'percentage', 'is_passed', 'attempt_no',
                'points_earned', 'submitted_at',
            ])

        attempt = QuizAttempt.objects.prefetch_related(
            'answers__question', 'answers__selected_option',
        ).get(pk=attempt.pk)
        return Response(
            QuizAttemptResultSerializer(attempt).data,
            status=status.HTTP_201_CREATED,
        )


class QuizAttemptListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        quiz_entity = _get_quiz_entity(pk)
        course = _find_course_for_quiz(quiz_entity)
        is_manager = can_manage_entity(request.user, quiz_entity) or (course and can_manage_entity(request.user, course))

        qs = QuizAttempt.objects.filter(quiz_entity=quiz_entity).select_related('learner').order_by('-started_at')
        role = getattr(request.user, 'role', None)
        if is_manager:
            pass
        elif role == 'learner':
            qs = qs.filter(learner=request.user)
        else:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        data = []
        for att in qs:
            row = {
                'id': att.id,
                'score': att.score,
                'total_marks': att.max_score,
                'percentage': att.percentage,
                'is_passed': att.is_passed,
                'submitted_at': att.submitted_at,
            }
            if is_manager:
                row['learner'] = BriefUserSerializer(att.learner).data
            data.append(row)
        return Response(data)


# ---------------------------------------------------------------------------
# Admin views
# ---------------------------------------------------------------------------

class AdminQuizListView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request):
        qs = ContentEntity.objects.filter(
            entity_type=EntityType.QUIZ,
        ).select_related('owner').order_by('-created_at')

        search = request.query_params.get('search')
        course_id = request.query_params.get('course')
        is_pub = request.query_params.get('is_published')
        if search:
            qs = qs.filter(title__icontains=search)
        if is_pub == 'true':
            qs = qs.filter(status_code=StatusCode.PUBLISHED)
        elif is_pub == 'false':
            qs = qs.exclude(status_code=StatusCode.PUBLISHED)
        if course_id:
            direct = ContentStructure.objects.filter(
                parent_entity_id=course_id, child_entity__entity_type=EntityType.QUIZ,
            ).values_list('child_entity_id', flat=True)
            module_ids = ContentStructure.objects.filter(
                parent_entity_id=course_id, child_entity__entity_type=EntityType.MODULE,
            ).values_list('child_entity_id', flat=True)
            nested = ContentStructure.objects.filter(
                parent_entity_id__in=module_ids, child_entity__entity_type=EntityType.QUIZ,
            ).values_list('child_entity_id', flat=True)
            quiz_ids = set(direct) | set(nested)
            qs = qs.filter(id__in=quiz_ids)

        qs = qs.annotate(_question_count=Count('quiz_questions', filter=Q(quiz_questions__is_active=True)))

        paginator = PageNumberPagination()
        paginator.page_size = request.query_params.get('page_size', 10)
        page = paginator.paginate_queryset(qs, request)

        results = []
        for qe in (page or qs):
            course = _find_course_for_quiz(qe)
            link = ContentStructure.objects.filter(child_entity=qe).first()
            module_title = None
            if link and link.parent_entity.entity_type == EntityType.MODULE:
                module_title = link.parent_entity.title
            results.append({
                'id': qe.id,
                'title': qe.title,
                'course_title': course.title if course else '',
                'module_title': module_title,
                'pass_percentage': getattr(getattr(qe, 'quiz_detail', None), 'pass_percentage', 50),
                'is_published': qe.status_code == StatusCode.PUBLISHED,
                'question_count': getattr(qe, '_question_count', 0),
                'created_at': qe.created_at,
            })
        if page is not None:
            return paginator.get_paginated_response(results)
        return Response(results)


class AdminQuizQuestionListView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request):
        qs = QuizQuestion.objects.select_related('quiz_entity').order_by('quiz_entity_id', 'sort_order', 'id')
        search = request.query_params.get('search')
        if search:
            qs = qs.filter(Q(question_text__icontains=search) | Q(quiz_entity__title__icontains=search))

        paginator = PageNumberPagination()
        paginator.page_size = request.query_params.get('page_size', 10)
        page = paginator.paginate_queryset(qs, request)
        data = AdminQuizQuestionListSerializer(page or qs, many=True).data
        if page is not None:
            return paginator.get_paginated_response(data)
        return Response(data)


class AdminQuizOptionListView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request):
        qs = QuizOption.objects.select_related('question', 'question__quiz_entity').order_by('question_id', 'sort_order', 'id')
        search = request.query_params.get('search')
        question_id = request.query_params.get('question')
        if search:
            qs = qs.filter(option_text__icontains=search)
        if question_id:
            qs = qs.filter(question_id=question_id)

        paginator = PageNumberPagination()
        paginator.page_size = request.query_params.get('page_size', 10)
        page = paginator.paginate_queryset(qs, request)
        data = AdminQuizOptionListSerializer(page or qs, many=True).data
        if page is not None:
            return paginator.get_paginated_response(data)
        return Response(data)


class AdminQuizAttemptListView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request):
        qs = QuizAttempt.objects.select_related('learner', 'quiz_entity').order_by('-started_at')
        search = request.query_params.get('search')
        quiz_id = request.query_params.get('quiz')
        is_passed = request.query_params.get('is_passed')
        if search:
            qs = qs.filter(Q(learner__email__icontains=search) | Q(quiz_entity__title__icontains=search))
        if quiz_id:
            qs = qs.filter(quiz_entity_id=quiz_id)
        if is_passed == 'true':
            qs = qs.filter(is_passed=True)
        elif is_passed == 'false':
            qs = qs.filter(is_passed=False)

        paginator = PageNumberPagination()
        paginator.page_size = request.query_params.get('page_size', 10)
        page = paginator.paginate_queryset(qs, request)
        data = AdminQuizAttemptListSerializer(page or qs, many=True).data
        if page is not None:
            return paginator.get_paginated_response(data)
        return Response(data)


class AdminQuizAnswerListView(APIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]

    def get(self, request):
        qs = QuizAttemptAnswer.objects.select_related(
            'attempt', 'question', 'selected_option',
        ).order_by('-attempt_id', 'id')
        search = request.query_params.get('search')
        attempt_id = request.query_params.get('attempt')
        if search:
            qs = qs.filter(question__question_text__icontains=search)
        if attempt_id:
            qs = qs.filter(attempt_id=attempt_id)

        paginator = PageNumberPagination()
        paginator.page_size = request.query_params.get('page_size', 10)
        page = paginator.paginate_queryset(qs, request)
        data = AdminQuizAnswerListSerializer(page or qs, many=True).data
        if page is not None:
            return paginator.get_paginated_response(data)
        return Response(data)
