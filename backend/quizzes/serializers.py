from rest_framework import serializers

from accounts.serializers import BriefUserSerializer
from courses.models import Module
from courses.serializers import BriefCourseSerializer

from .models import Quiz, QuizAnswer, QuizAttempt, QuizOption, QuizQuestion


class BriefModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = ['id', 'title', 'sort_order']


class QuizOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizOption
        fields = ['id', 'option_text', 'is_correct', 'sort_order']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if request and self._hide_correct_flags(request, instance):
            data.pop('is_correct', None)
        return data

    def _hide_correct_flags(self, request, instance):
        user = request.user
        if not user.is_authenticated:
            return True
        role = getattr(user, 'role', None)
        if role == 'admin':
            return False
        course = instance.question.quiz.course
        if role == 'instructor' and course.instructor_id == user.id:
            return False
        return True


class QuizQuestionSerializer(serializers.ModelSerializer):
    options = QuizOptionSerializer(many=True, read_only=True)

    class Meta:
        model = QuizQuestion
        fields = ['id', 'question_text', 'question_type', 'marks', 'sort_order', 'options']


class QuizOptionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizOption
        fields = ['option_text', 'is_correct']


class QuizQuestionWriteSerializer(serializers.ModelSerializer):
    options = QuizOptionWriteSerializer(many=True)

    class Meta:
        model = QuizQuestion
        fields = ['question_text', 'marks', 'sort_order', 'options']

    def validate_options(self, value):
        if not value:
            raise serializers.ValidationError('Each question must have at least one option.')
        if not any(c.get('is_correct') for c in value):
            raise serializers.ValidationError('Each question must have at least one correct option.')
        return value


class QuizListSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()
    course_id = serializers.IntegerField(source='course.id', read_only=True)

    class Meta:
        model = Quiz
        fields = [
            'id',
            'title',
            'description',
            'question_count',
            'course_id',
            'module_id',
            'pass_percentage',
            'is_published',
            'created_at',
        ]

    def get_question_count(self, obj):
        annotated = getattr(obj, 'question_count', None)
        return annotated if annotated is not None else obj.questions.count()


class QuizDetailSerializer(serializers.ModelSerializer):
    course = BriefCourseSerializer(read_only=True)
    module = BriefModuleSerializer(read_only=True, allow_null=True)
    questions = QuizQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Quiz
        fields = [
            'id',
            'course',
            'module',
            'title',
            'description',
            'pass_percentage',
            'is_published',
            'created_at',
            'questions',
        ]
        read_only_fields = fields


class QuizWriteSerializer(serializers.ModelSerializer):
    questions = QuizQuestionWriteSerializer(many=True)

    class Meta:
        model = Quiz
        fields = ['title', 'description', 'module', 'pass_percentage', 'questions']

    def validate(self, attrs):
        module = attrs.get('module')
        course = self.context.get('course')
        if module is not None and course is not None and module.course_id != course.id:
            raise serializers.ValidationError({'module': 'Module must belong to the same course.'})
        return attrs

    def create(self, validated_data):
        questions_data = validated_data.pop('questions')
        course = self.context['course']
        module = validated_data.pop('module', None)
        quiz = Quiz.objects.create(course=course, module=module, **validated_data)
        for q_order, q_data in enumerate(questions_data):
            q_data = dict(q_data)
            options_data = q_data.pop('options')
            question = QuizQuestion.objects.create(
                quiz=quiz,
                question_text=q_data['question_text'],
                question_type='mcq',
                marks=q_data.get('marks', 1),
                sort_order=q_data.get('sort_order', q_order),
            )
            for opt_order, o_data in enumerate(options_data):
                QuizOption.objects.create(
                    question=question,
                    option_text=o_data['option_text'],
                    is_correct=o_data['is_correct'],
                    sort_order=o_data.get('sort_order', opt_order),
                )
        return quiz

    def update(self, instance, validated_data):
        questions_data = validated_data.pop('questions', None)
        if 'module' in validated_data:
            instance.module = validated_data.pop('module')
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if questions_data is not None:
            instance.questions.all().delete()
            for q_order, q_data in enumerate(questions_data):
                q_data = dict(q_data)
                options_data = q_data.pop('options')
                question = QuizQuestion.objects.create(
                    quiz=instance,
                    question_text=q_data['question_text'],
                    question_type='mcq',
                    marks=q_data.get('marks', 1),
                    sort_order=q_data.get('sort_order', q_order),
                )
                for opt_order, o_data in enumerate(options_data):
                    QuizOption.objects.create(
                        question=question,
                        option_text=o_data['option_text'],
                        is_correct=o_data['is_correct'],
                        sort_order=o_data.get('sort_order', opt_order),
                    )
        return instance


class QuizAttemptItemSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    option_id = serializers.IntegerField()


class QuizAttemptSerializer(serializers.Serializer):
    answers = QuizAttemptItemSerializer(many=True)

    def validate(self, attrs):
        if not attrs.get('answers'):
            raise serializers.ValidationError({'answers': 'At least one answer is required.'})
        return attrs


class QuizAnswerResultSerializer(serializers.ModelSerializer):
    question_id = serializers.IntegerField(source='question.id', read_only=True)
    selected_option_id = serializers.IntegerField(source='selected_option.id', read_only=True)

    class Meta:
        model = QuizAnswer
        fields = ['question_id', 'selected_option_id', 'is_correct', 'marks_awarded']


class QuizAttemptResultSerializer(serializers.ModelSerializer):
    answers = QuizAnswerResultSerializer(many=True, read_only=True)

    class Meta:
        model = QuizAttempt
        fields = ['score', 'total_marks', 'percentage', 'is_passed', 'submitted_at', 'answers']


class AdminQuizListSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True)
    module_title = serializers.SerializerMethodField()
    question_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Quiz
        fields = [
            'id',
            'title',
            'course_title',
            'module_title',
            'pass_percentage',
            'is_published',
            'question_count',
            'created_at',
        ]

    def get_module_title(self, obj):
        return obj.module.title if obj.module_id else None


class AdminQuizQuestionListSerializer(serializers.ModelSerializer):
    quiz_title = serializers.CharField(source='quiz.title', read_only=True)

    class Meta:
        model = QuizQuestion
        fields = ['id', 'quiz_title', 'question_text', 'question_type', 'marks', 'sort_order', 'created_at']


class AdminQuizOptionListSerializer(serializers.ModelSerializer):
    question_text_preview = serializers.SerializerMethodField()

    class Meta:
        model = QuizOption
        fields = ['id', 'question_text_preview', 'option_text', 'is_correct', 'sort_order']

    def get_question_text_preview(self, obj):
        text = obj.question.question_text or ''
        if len(text) > 120:
            return text[:120] + '…'
        return text


class AdminQuizAttemptListSerializer(serializers.ModelSerializer):
    learner_name = serializers.SerializerMethodField()
    learner_email = serializers.EmailField(source='learner.email', read_only=True)
    quiz_title = serializers.CharField(source='quiz.title', read_only=True)

    class Meta:
        model = QuizAttempt
        fields = [
            'id',
            'learner_name',
            'learner_email',
            'quiz_title',
            'score',
            'total_marks',
            'percentage',
            'is_passed',
            'started_at',
            'submitted_at',
        ]

    def get_learner_name(self, obj):
        u = obj.learner
        name = (u.get_full_name() or '').strip()
        return name or u.email


class AdminQuizAnswerListSerializer(serializers.ModelSerializer):
    attempt_id = serializers.IntegerField(source='attempt.id', read_only=True)
    question_text_preview = serializers.SerializerMethodField()
    selected_option_text = serializers.CharField(source='selected_option.option_text', read_only=True)

    class Meta:
        model = QuizAnswer
        fields = [
            'id',
            'attempt_id',
            'question_text_preview',
            'selected_option_text',
            'is_correct',
            'marks_awarded',
        ]

    def get_question_text_preview(self, obj):
        text = obj.question.question_text or ''
        if len(text) > 120:
            return text[:120] + '…'
        return text
