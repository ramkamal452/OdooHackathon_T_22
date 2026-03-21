import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class MembershipStatus(models.IntegerChoices):
    INVITED = 1, 'Invited'
    ACTIVE = 2, 'Active'
    COMPLETED = 3, 'Completed'
    REVOKED = 4, 'Revoked'
    EXPIRED = 5, 'Expired'


class AccessMode(models.IntegerChoices):
    OPEN = 1, 'Open'
    INVITATION = 2, 'Invitation'
    ADMIN_ASSIGNED = 3, 'Admin assigned'
    IMPORTED = 4, 'Imported'


class ProgressStatus(models.IntegerChoices):
    NOT_STARTED = 1, 'Not started'
    IN_PROGRESS = 2, 'In progress'
    COMPLETED = 3, 'Completed'
    FAILED = 4, 'Failed'
    LOCKED = 5, 'Locked'


class CourseMembership(models.Model):
    course_entity = models.ForeignKey(
        'content.ContentEntity',
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='course_memberships',
    )
    invited_email = models.EmailField(blank=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invitations_sent',
    )
    invite_token = models.CharField(max_length=64, unique=True, null=True, blank=True)
    membership_status = models.PositiveSmallIntegerField(
        choices=MembershipStatus.choices,
        default=MembershipStatus.ACTIVE,
    )
    access_mode = models.PositiveSmallIntegerField(
        choices=AccessMode.choices,
        default=AccessMode.OPEN,
    )
    invited_at = models.DateTimeField(null=True, blank=True)
    enrolled_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_accessed_at = models.DateTimeField(null=True, blank=True)
    progress_percent = models.PositiveSmallIntegerField(default=0)
    time_spent_seconds = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['course_entity', 'user'],
                condition=models.Q(user__isnull=False),
                name='unique_course_user_membership',
            ),
        ]
        indexes = [
            models.Index(fields=['course_entity', 'membership_status']),
            models.Index(fields=['user', 'membership_status']),
        ]

    def __str__(self):
        who = self.user or self.invited_email
        return f'{who} -> entity {self.course_entity_id}'

    def generate_invite_token(self):
        self.invite_token = uuid.uuid4().hex
        return self.invite_token

    def recalculate_progress(self):
        from content.models import ContentStructure, EntityType

        required_links = ContentStructure.objects.filter(
            parent_entity=self.course_entity,
            is_required=True,
        ).values_list('child_entity_id', flat=True)

        child_ids = list(required_links)

        module_ids = list(
            ContentStructure.objects.filter(
                parent_entity=self.course_entity,
                child_entity__entity_type=EntityType.MODULE,
            ).values_list('child_entity_id', flat=True)
        )
        if module_ids:
            nested_children = ContentStructure.objects.filter(
                parent_entity_id__in=module_ids,
                is_required=True,
            ).values_list('child_entity_id', flat=True)
            child_ids.extend(nested_children)

        leaf_ids = [
            cid for cid in child_ids if cid not in module_ids
        ]

        total = len(leaf_ids)
        if total == 0:
            pct = 0
        else:
            completed = EntityProgress.objects.filter(
                learner=self.user,
                entity_id__in=leaf_ids,
                progress_status=ProgressStatus.COMPLETED,
            ).count()
            pct = min(100, round((completed / total) * 100))

        self.progress_percent = pct
        update_fields = ['progress_percent']

        if pct >= 100 and self.membership_status != MembershipStatus.COMPLETED:
            self.membership_status = MembershipStatus.COMPLETED
            self.completed_at = timezone.now()
            update_fields.extend(['membership_status', 'completed_at'])
        elif pct > 0 and self.started_at is None:
            self.started_at = timezone.now()
            self.membership_status = MembershipStatus.ACTIVE
            update_fields.extend(['started_at', 'membership_status'])

        self.save(update_fields=update_fields)


class EntityProgress(models.Model):
    learner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='entity_progress',
    )
    entity = models.ForeignKey(
        'content.ContentEntity',
        on_delete=models.CASCADE,
        related_name='progress_records',
    )
    progress_status = models.PositiveSmallIntegerField(
        choices=ProgressStatus.choices,
        default=ProgressStatus.NOT_STARTED,
    )
    progress_percent = models.PositiveSmallIntegerField(default=0)
    last_position_seconds = models.PositiveIntegerField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_accessed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [['learner', 'entity']]

    def __str__(self):
        return f'{self.learner_id} -> entity {self.entity_id}'
