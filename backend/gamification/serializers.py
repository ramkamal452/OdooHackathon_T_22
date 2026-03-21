from rest_framework import serializers

from .models import Badge, UserBadge, UserPointLedger


class BadgeSerializer(serializers.ModelSerializer):
    icon_url = serializers.SerializerMethodField()

    class Meta:
        model = Badge
        fields = ['id', 'name', 'slug', 'description', 'min_points', 'icon_url', 'sort_order']

    def get_icon_url(self, obj):
        if obj.icon_asset_id:
            return obj.icon_asset.url
        return None


class UserBadgeSerializer(serializers.ModelSerializer):
    badge = BadgeSerializer(read_only=True)

    class Meta:
        model = UserBadge
        fields = ['id', 'badge', 'awarded_at']


class UserPointLedgerSerializer(serializers.ModelSerializer):
    source_type_label = serializers.CharField(
        source='get_source_type_display', read_only=True,
    )

    class Meta:
        model = UserPointLedger
        fields = ['id', 'source_type', 'source_type_label', 'points', 'reason', 'created_at']
