from django.urls import path

from .views import DesignRevisionSubmitView

urlpatterns = [
    path("cad/design-revisions/", DesignRevisionSubmitView.as_view(), name="cad_design_revision_submit"),
]