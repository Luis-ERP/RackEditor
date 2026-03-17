from django.urls import path

from .views import SaveCadAndCreateQuoteView

urlpatterns = [
    path("quotes/from-cad/", SaveCadAndCreateQuoteView.as_view(), name="quote_from_cad"),
]
