from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Badge, UserBadge, UserPointLedger
from .serializers import BadgeSerializer, UserBadgeSerializer, UserPointLedgerSerializer


class BadgeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        badges = Badge.objects.filter(is_active=True).order_by('sort_order')
        return Response(BadgeSerializer(badges, many=True).data)


class MyBadgesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        earned = UserBadge.objects.filter(user=request.user).select_related('badge').order_by('-awarded_at')
        return Response(UserBadgeSerializer(earned, many=True).data)


class MyPointsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        entries = UserPointLedger.objects.filter(user=request.user).order_by('-created_at')[:50]
        return Response(UserPointLedgerSerializer(entries, many=True).data)
