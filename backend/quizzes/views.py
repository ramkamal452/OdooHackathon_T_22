from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsInstructorOrAdmin, IsLearner
from accounts.serializers import BriefUserSerializer
from courses.models import Course
from courses.models import can_access_course_quizzes, can_manage_course

from .models import Quiz, QuizAnswer, QuizAttempt, QuizOption, QuizQuestion
from .serializers import (
    AdminQuizAnswerListSerializer,
    AdminQuizAttemptListSerializer,
    AdminQuizListSerializer,
    AdminQuizOptionListSerializer,
    AdminQuizQuestionListSerializer,
    QuizAttemptResultSerializer,
    QuizAttemptSerializer,
    QuizDetailSerializer,
    QuizListSerializer,
    QuizWriteSerializer,
)


class QuizListCreateView(generics.ListCreateAPIView):
    pagination_class = None
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return QuizWriteSerializer
        return QuizListSerializer

    def get_queryset(self):
        course_id = self.kwargs['course_id']
        course = get_object_or_404(Course, pk=course_id)
        if not can_access_course_quizzes(self.request.user, course):
            raise NotFound()
        qs = Quiz.objects.filter(course_id=course_id).annotate(
            question_count=Count('questions', distinct=True),
        )
        if not can_manage_course(self.request.user, course):
            qs = qs.filter(is_published=True)
        return qs.order_by('-created_at')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.method == 'POST':
            course_id = self.kwargs['course_id']
            ctx['course'] = get_object_or_404(Course, pk=course_id)
        return ctx

    def perform_create(self, serializer):
        course = get_object_or_404(Course, pk=self.kwargs['course_id'])
        if not can_manage_course(self.request.user, course):
            raise PermissionDenied('Only the course owner or an admin can create quizzes.')
        serializer.save()


class QuizDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return QuizWriteSerializer
        return QuizDetailSerializer

    def get_queryset(self):
        return Quiz.objects.select_related('course', 'course__instructor', 'module').prefetch_related(
            'questions__options',
        )

    def get_object(self):
        quiz = super().get_object()
        if not can_access_course_quizzes(self.request.user, quiz.course):
            raise NotFound()
        if not can_manage_course(self.request.user, quiz.course) and not quiz.is_published:
            raise NotFound()
        return quiz

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.method in ('PUT', 'PATCH'):
            ctx['course'] = self.get_object().course
        return ctx

    def perform_update(self, serializer):
        quiz = serializer.instance
        if not can_manage_course(self.request.user, quiz.course):
            raise PermissionDenied('You do not have permission to update this quiz.')
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_course(self.request.user, instance.course):
            raise PermissionDenied('You do not have permission to delete this quiz.')
        instance.delete()


class QuizAttemptSubmitView(APIView):
    permission_classes = [IsAuthenticated, IsLearner]

    def post(self, request, pk):
        quiz = get_object_or_404(
            Quiz.objects.select_related('course').prefetch_related('questions'),
            pk=pk,
        )
        course = quiz.course
        if not can_access_course_quizzes(request.user, course):
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not can_manage_course(request.user, course) and not quiz.is_published:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        ser = QuizAttemptSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        answers_in = ser.validated_data['answers']
        questions = list(quiz.questions.all())
        question_ids = {q.id for q in questions}
        if len(answers_in) != len(question_ids):
            return Response(
                {'detail': 'You must answer every question.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        submitted_q = set()
        for item in answers_in:
            qid = item['question_id']
            if qid in submitted_q:
                return Response(
                    {'detail': 'Invalid or duplicate questions in submission.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            submitted_q.add(qid)
        if submitted_q != question_ids:
            return Response(
                {'detail': 'Invalid or duplicate questions in submission.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        total_marks = sum(q.marks for q in questions)
        if total_marks == 0:
            return Response(
                {'detail': 'Quiz has no marks configured.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        score = 0
        now = timezone.now()
        with transaction.atomic():
            attempt = QuizAttempt.objects.create(
                quiz=quiz,
                learner=request.user,
                score=0,
                total_marks=total_marks,
                percentage=Decimal('0'),
                is_passed=False,
            )
            for item in answers_in:
                qid = item['question_id']
                oid = item['option_id']
                question = get_object_or_404(QuizQuestion, pk=qid, quiz=quiz)
                option = get_object_or_404(QuizOption, pk=oid, question=question)
                is_correct = option.is_correct
                marks_awarded = question.marks if is_correct else 0
                score += marks_awarded
                QuizAnswer.objects.create(
                    attempt=attempt,
                    question=question,
                    selected_option=option,
                    is_correct=is_correct,
                    marks_awarded=marks_awarded,
                )
            pct = (Decimal(score) / Decimal(total_marks)) * Decimal(100)
            pct = pct.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            is_passed = pct >= Decimal(quiz.pass_percentage)
            attempt.score = score
            attempt.percentage = pct
            attempt.is_passed = is_passed
            attempt.submitted_at = now
            attempt.save(update_fields=['score', 'percentage', 'is_passed', 'submitted_at'])

        attempt = QuizAttempt.objects.prefetch_related(
            'answers__question',
            'answers__selected_option',
        ).get(pk=attempt.pk)
        return Response(
            QuizAttemptResultSerializer(attempt).data,
            status=status.HTTP_201_CREATED,
        )


class QuizAttemptListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        quiz = get_object_or_404(Quiz.objects.select_related('course'), pk=self.kwargs['pk'])
        if not can_access_course_quizzes(request.user, quiz.course):
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not can_manage_course(request.user, quiz.course) and not quiz.is_published:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        qs = QuizAttempt.objects.filter(quiz=quiz).select_related('learner').order_by('-started_at')
        role = getattr(request.user, 'role', None)
        if role == 'admin' or (role == 'instructor' and can_manage_course(request.user, quiz.course)):
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
                'total_marks': att.total_marks,
                'percentage': att.percentage,
                'is_passed': att.is_passed,
                'submitted_at': att.submitted_at,
            }
            if role in ('admin', 'instructor'):
                row['learner'] = BriefUserSerializer(att.learner).data
            data.append(row)
        return Response(data)


def _optional_bool_param(raw):
    if raw is None or raw == '':
        return None
    s = str(raw).lower()
    if s in ('1', 'true', 'yes', 'on'):
        return True
    if s in ('0', 'false', 'no', 'off'):
        return False
    return None


class AdminQuizListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    serializer_class = AdminQuizListSerializer

    def get_queryset(self):
        qs = (
            Quiz.objects.select_related('course', 'module')
            .annotate(question_count=Count('questions', distinct=True))
            .order_by('-created_at')
        )
        search = self.request.query_params.get('search')
        course_id = self.request.query_params.get('course')
        is_pub = _optional_bool_param(self.request.query_params.get('is_published'))
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(course__title__icontains=search))
        if course_id:
            qs = qs.filter(course_id=course_id)
        if is_pub is not None:
            qs = qs.filter(is_published=is_pub)
        return qs


class AdminQuizQuestionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    serializer_class = AdminQuizQuestionListSerializer

    def get_queryset(self):
        qs = QuizQuestion.objects.select_related('quiz').order_by('quiz_id', 'sort_order', 'id')
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(question_text__icontains=search) | Q(quiz__title__icontains=search))
        return qs


class AdminQuizOptionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    serializer_class = AdminQuizOptionListSerializer

    def get_queryset(self):
        qs = QuizOption.objects.select_related('question', 'question__quiz').order_by(
            'question_id', 'sort_order', 'id'
        )
        search = self.request.query_params.get('search')
        question_id = self.request.query_params.get('question')
        if search:
            qs = qs.filter(option_text__icontains=search)
        if question_id:
            qs = qs.filter(question_id=question_id)
        return qs


class AdminQuizAttemptListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    serializer_class = AdminQuizAttemptListSerializer

    def get_queryset(self):
        qs = QuizAttempt.objects.select_related('learner', 'quiz').order_by('-started_at')
        search = self.request.query_params.get('search')
        quiz_id = self.request.query_params.get('quiz')
        is_passed = _optional_bool_param(self.request.query_params.get('is_passed'))
        if search:
            qs = qs.filter(Q(learner__email__icontains=search) | Q(quiz__title__icontains=search))
        if quiz_id:
            qs = qs.filter(quiz_id=quiz_id)
        if is_passed is not None:
            qs = qs.filter(is_passed=is_passed)
        return qs


class AdminQuizAnswerListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsInstructorOrAdmin]
    serializer_class = AdminQuizAnswerListSerializer

    def get_queryset(self):
        qs = QuizAnswer.objects.select_related('attempt', 'question', 'selected_option').order_by(
            '-attempt_id', 'id'
        )
        search = self.request.query_params.get('search')
        attempt_id = self.request.query_params.get('attempt')
        if search:
            qs = qs.filter(question__question_text__icontains=search)
        if attempt_id:
            qs = qs.filter(attempt_id=attempt_id)
        return qs
