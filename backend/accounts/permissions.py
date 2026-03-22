from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'admin'
        )


class IsInstructorOrAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return getattr(request.user, 'role', None) in ('admin', 'instructor')


class IsLearner(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'learner'
        )


def can_manage_entity(user, entity):
    role = getattr(user, 'role', None)
    if role == 'admin':
        return True
    if role == 'instructor' and entity.owner_id == user.id:
        return True
    return False


def can_view_entity(user, entity):
    from content.models import StatusCode
    if can_manage_entity(user, entity):
        return True
    if entity.status_code != StatusCode.PUBLISHED:
        return False
    try:
        settings = entity.course_settings
        from content.models import VisibilityCode
        if settings.visibility_code == VisibilityCode.SIGNED_IN and not user.is_authenticated:
            return False
    except Exception:
        pass
    return True


def learner_has_membership(user, course_entity):
    from enrollment.models import CourseMembership, MembershipStatus
    return CourseMembership.objects.filter(
        course_entity=course_entity,
        user=user,
        membership_status__in=[MembershipStatus.ACTIVE, MembershipStatus.COMPLETED],
    ).exists()


def can_access_content(user, entity, _visited=None):
    """
    Return True if the user is allowed to access this content entity.
    Walks the full ancestor chain so deeply nested content (e.g. Course →
    Module → Lesson → Quiz) is correctly handled.
    """
    from content.models import ContentStructure, EntityType
    if can_manage_entity(user, entity):
        return True

    if _visited is None:
        _visited = set()
    if entity.pk in _visited:
        return False  # cycle guard
    _visited.add(entity.pk)

    parent_links = ContentStructure.objects.filter(
        child_entity=entity
    ).select_related('parent_entity')

    for link in parent_links:
        parent = link.parent_entity
        if parent.entity_type == EntityType.COURSE:
            if learner_has_membership(user, parent):
                return True
        else:
            # Walk further up recursively (handles Module, Lesson, etc.)
            if can_access_content(user, parent, _visited):
                return True

    return False

