from rest_framework import serializers

from accounts.serializers import BriefUserSerializer

from .models import CourseMembership, EntityProgress, MembershipStatus


class BriefCourseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    slug = serializers.CharField()


class EnrollmentSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    course = BriefCourseSerializer()
    learner = BriefUserSerializer()
    status = serializers.CharField()
    progress_percent = serializers.IntegerField()
    time_spent_seconds = serializers.IntegerField()
    enrolled_at = serializers.DateTimeField()
    completed_at = serializers.DateTimeField(allow_null=True)

    @classmethod
    def from_membership(cls, mem, request=None):
        entity = mem.course_entity
        status_map = {
            MembershipStatus.ACTIVE: 'yet_to_start' if mem.progress_percent == 0 and mem.started_at is None else 'in_progress',
            MembershipStatus.COMPLETED: 'completed',
            MembershipStatus.INVITED: 'invited',
            MembershipStatus.REVOKED: 'revoked',
            MembershipStatus.EXPIRED: 'expired',
        }
        return {
            'id': mem.id,
            'course': {'id': entity.id, 'title': entity.title, 'slug': entity.slug},
            'learner': BriefUserSerializer(mem.user).data if mem.user else None,
            'status': status_map.get(mem.membership_status, 'yet_to_start'),
            'progress_percent': mem.progress_percent,
            'time_spent_seconds': mem.time_spent_seconds,
            'enrolled_at': mem.enrolled_at,
            'completed_at': mem.completed_at,
        }


class MyEnrollmentSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    course_id = serializers.IntegerField()
    course_title = serializers.CharField()
    course_slug = serializers.CharField()
    status = serializers.CharField()
    progress_percent = serializers.IntegerField()
    time_spent_seconds = serializers.IntegerField()
    enrolled_at = serializers.DateTimeField()
    completed_at = serializers.DateTimeField(allow_null=True)

    @classmethod
    def from_membership(cls, mem):
        entity = mem.course_entity
        status_map = {
            MembershipStatus.ACTIVE: 'yet_to_start' if mem.progress_percent == 0 and mem.started_at is None else 'in_progress',
            MembershipStatus.COMPLETED: 'completed',
        }
        return {
            'id': mem.id,
            'course_id': entity.id,
            'course_title': entity.title,
            'course_slug': entity.slug,
            'status': status_map.get(mem.membership_status, 'yet_to_start'),
            'progress_percent': mem.progress_percent,
            'time_spent_seconds': mem.time_spent_seconds,
            'enrolled_at': mem.enrolled_at,
            'completed_at': mem.completed_at,
        }
