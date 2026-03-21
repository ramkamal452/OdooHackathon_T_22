from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'admin'
        )


class IsInstructor(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'instructor'
        )


class IsLearner(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'learner'
        )


class IsInstructorOrAdmin(BasePermission):
    def has_permission(self, request, view):
        role = getattr(request.user, 'role', None) if request.user.is_authenticated else None
        return bool(request.user and request.user.is_authenticated and role in ('instructor', 'admin'))
