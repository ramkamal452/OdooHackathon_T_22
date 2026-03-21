from rest_framework import serializers

from accounts.serializers import BriefUserSerializer

from .models import QuizAttempt, QuizAttemptAnswer, QuizOption, QuizQuestion


# ---------------------------------------------------------------------------
# Option serializers
# ---------------------------------------------------------------------------

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
        quiz_entity = instance.question.quiz_entity
        if role == 'instructor' and quiz_entity.owner_id == user.id:
            return False
        return True


class QuizOptionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizOption
        fields = ['option_text', 'is_correct']


# ---------------------------------------------------------------------------
# Question serializers
# ---------------------------------------------------------------------------

class QuizQuestionSerializer(serializers.ModelSerializer):
    options = QuizOptionSerializer(many=True, read_only=True)

    class Meta:
        model = QuizQuestion
        fields = ['id', 'question_text', 'question_type', 'marks', 'sort_order', 'options']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['question_type'] = 'mcq'
        return data


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


# ---------------------------------------------------------------------------
# Quiz list / detail
# ---------------------------------------------------------------------------

class QuizListSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    description = serializers.CharField()
    question_count = serializers.IntegerField()
    course_id = serializers.IntegerField(allow_null=True)
    module_id = serializers.IntegerField(allow_null=True)
    pass_percentage = serializers.IntegerField()
    is_published = serializers.BooleanField()
    reward_first_try = serializers.IntegerField()
    reward_second_try = serializers.IntegerField()
    reward_third_try = serializers.IntegerField()
    reward_fourth_plus = serializers.IntegerField()
    created_at = serializers.DateTimeField()


class QuizDetailSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    course = serializers.DictField()
    module = serializers.DictField(allow_null=True)
    title = serializers.CharField()
    description = serializers.CharField()
    pass_percentage = serializers.IntegerField()
    is_published = serializers.BooleanField()
    reward_first_try = serializers.IntegerField()
    reward_second_try = serializers.IntegerField()
    reward_third_try = serializers.IntegerField()
    reward_fourth_plus = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    questions = serializers.ListField()


# ---------------------------------------------------------------------------
# Quiz write
# ---------------------------------------------------------------------------

class QuizWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    module = serializers.IntegerField(required=False, allow_null=True)
    pass_percentage = serializers.IntegerField(required=False, default=50)
    is_published = serializers.BooleanField(required=False, default=False)
    reward_first_try = serializers.IntegerField(required=False, default=10)
    reward_second_try = serializers.IntegerField(required=False, default=8)
    reward_third_try = serializers.IntegerField(required=False, default=5)
    reward_fourth_plus = serializers.IntegerField(required=False, default=2)
    questions = QuizQuestionWriteSerializer(many=True)


# ---------------------------------------------------------------------------
# Attempt serializers
# ---------------------------------------------------------------------------

class QuizAttemptItemSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    option_id = serializers.IntegerField()


class QuizAttemptSubmitSerializer(serializers.Serializer):
    answers = QuizAttemptItemSerializer(many=True)

    def validate(self, attrs):
        if not attrs.get('answers'):
            raise serializers.ValidationError({'answers': 'At least one answer is required.'})
        return attrs


class QuizAnswerResultSerializer(serializers.ModelSerializer):
    question_id = serializers.IntegerField(source='question.id', read_only=True)
    selected_option_id = serializers.SerializerMethodField()

    class Meta:
        model = QuizAttemptAnswer
        fields = ['question_id', 'selected_option_id', 'is_correct', 'marks_awarded']

    def get_selected_option_id(self, obj):
        return obj.selected_option_id


class QuizAttemptResultSerializer(serializers.ModelSerializer):
    answers = QuizAnswerResultSerializer(many=True, read_only=True)
    attempt_number = serializers.IntegerField(source='attempt_no')
    total_marks = serializers.IntegerField(source='max_score')
    total_points = serializers.SerializerMethodField()

    class Meta:
        model = QuizAttempt
        fields = [
            'score', 'total_marks', 'percentage', 'is_passed',
            'attempt_number', 'points_earned', 'total_points', 'submitted_at', 'answers',
        ]

    def get_total_points(self, obj):
        if obj.learner:
            obj.learner.refresh_from_db(fields=['points'])
            return obj.learner.points
        return 0


# ---------------------------------------------------------------------------
# Admin list serializers
# ---------------------------------------------------------------------------

class AdminQuizListSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    course_title = serializers.CharField()
    module_title = serializers.CharField(allow_null=True)
    pass_percentage = serializers.IntegerField()
    is_published = serializers.BooleanField()
    question_count = serializers.IntegerField()
    created_at = serializers.DateTimeField()


class AdminQuizQuestionListSerializer(serializers.ModelSerializer):
    quiz_title = serializers.CharField(source='quiz_entity.title', read_only=True)

    class Meta:
        model = QuizQuestion
        fields = ['id', 'quiz_title', 'question_text', 'question_type', 'marks', 'sort_order', 'created_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['question_type'] = 'mcq'
        return data


class AdminQuizOptionListSerializer(serializers.ModelSerializer):
    question_text_preview = serializers.SerializerMethodField()

    class Meta:
        model = QuizOption
        fields = ['id', 'question_text_preview', 'option_text', 'is_correct', 'sort_order']

    def get_question_text_preview(self, obj):
        text = obj.question.question_text or ''
        return text[:120] + '…' if len(text) > 120 else text


class AdminQuizAttemptListSerializer(serializers.ModelSerializer):
    learner_name = serializers.SerializerMethodField()
    learner_email = serializers.EmailField(source='learner.email', read_only=True)
    quiz_title = serializers.CharField(source='quiz_entity.title', read_only=True)
    attempt_number = serializers.IntegerField(source='attempt_no')
    total_marks = serializers.IntegerField(source='max_score')

    class Meta:
        model = QuizAttempt
        fields = [
            'id', 'learner_name', 'learner_email', 'quiz_title',
            'score', 'total_marks', 'percentage', 'is_passed',
            'attempt_number', 'points_earned', 'started_at', 'submitted_at',
        ]

    def get_learner_name(self, obj):
        u = obj.learner
        name = (u.get_full_name() or '').strip()
        return name or u.email


class AdminQuizAnswerListSerializer(serializers.ModelSerializer):
    attempt_id = serializers.IntegerField(source='attempt.id', read_only=True)
    question_text_preview = serializers.SerializerMethodField()
    selected_option_text = serializers.CharField(
        source='selected_option.option_text', read_only=True, default='',
    )

    class Meta:
        model = QuizAttemptAnswer
        fields = [
            'id', 'attempt_id', 'question_text_preview',
            'selected_option_text', 'is_correct', 'marks_awarded',
        ]

    def get_question_text_preview(self, obj):
        text = obj.question.question_text or ''
        return text[:120] + '…' if len(text) > 120 else text
