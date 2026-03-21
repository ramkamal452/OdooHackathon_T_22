from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsLearner, learner_has_membership
from content.models import ContentEntity, EntityType
from reviews.models import CourseReview
from reviews.serializers import CourseReviewSerializer


class CourseReviewListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        entity = get_object_or_404(ContentEntity, pk=pk, entity_type=EntityType.COURSE)
        reviews = CourseReview.objects.filter(
            course_entity=entity, is_published=True,
        ).select_related('user').order_by('-created_at')
        data = CourseReviewSerializer(reviews, many=True, context={'request': request}).data
        return Response(data)

    def post(self, request, pk):
        if getattr(request.user, 'role', None) != 'learner':
            return Response({'detail': 'Only learners can review.'}, status=status.HTTP_403_FORBIDDEN)
        entity = get_object_or_404(ContentEntity, pk=pk, entity_type=EntityType.COURSE)
        if not learner_has_membership(request.user, entity):
            return Response({'detail': 'You must be enrolled to review.'}, status=status.HTTP_403_FORBIDDEN)

        rating = request.data.get('rating', 5)
        review_text = request.data.get('review_text', '')
        review, created = CourseReview.objects.update_or_create(
            course_entity=entity,
            user=request.user,
            defaults={'rating': rating, 'review_text': review_text},
        )
        return Response(
            {'detail': 'Review saved.', 'id': review.id},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
