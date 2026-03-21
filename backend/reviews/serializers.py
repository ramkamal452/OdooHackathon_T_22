from rest_framework import serializers

from .models import CourseReview


class CourseReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_avatar = serializers.SerializerMethodField()
    course = serializers.IntegerField(source='course_entity_id', read_only=True)

    class Meta:
        model = CourseReview
        fields = [
            'id', 'course', 'user', 'user_name', 'user_avatar',
            'rating', 'review_text', 'created_at',
        ]
        read_only_fields = ['id', 'course', 'user', 'user_name', 'user_avatar', 'created_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.email

    def get_user_avatar(self, obj):
        request = self.context.get('request')
        if obj.user.avatar and request:
            return request.build_absolute_uri(obj.user.avatar.url)
        return None
