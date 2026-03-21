from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('content.urls')),
    path('api/', include('enrollment.urls')),
    path('api/quizzes/', include('quizzes.urls')),
    path('api/', include('gamification.urls')),
    path('api/', include('reviews.urls')),
]
