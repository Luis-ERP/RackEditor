from django.conf import settings
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('api/', include('cad.urls')),
    path('api/', include('quoter.urls')),
]

if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()
