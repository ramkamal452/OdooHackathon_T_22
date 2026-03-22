from django.urls import path

from .views import (
    CustomTokenObtainPairView,
    RefreshTokenView,
    RegisterView,
    UserListView,
    UserProfileView,
    ChangePasswordView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='auth-login'),
    path('token/refresh/', RefreshTokenView.as_view(), name='auth-token-refresh'),
    path('me/', UserProfileView.as_view(), name='auth-me'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('users/', UserListView.as_view(), name='user-list'),
]
