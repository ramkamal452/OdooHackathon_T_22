from django.urls import path

from .views import BadgeListView, MyBadgesView, MyPointsView

urlpatterns = [
    path('badges/', BadgeListView.as_view(), name='badge-list'),
    path('my/badges/', MyBadgesView.as_view(), name='my-badges'),
    path('my/points/', MyPointsView.as_view(), name='my-points'),
]
