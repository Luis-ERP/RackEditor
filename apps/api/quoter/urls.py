from django.urls import path

from .views import (
    QuoteBulkDeleteView,
    QuoteDetailView,
    QuoteDuplicateView,
    QuoteListView,
    SaveCadAndCreateQuoteView,
)

urlpatterns = [
    path("quotes/", QuoteListView.as_view(), name="quote_list"),
    path("quotes/bulk/", QuoteBulkDeleteView.as_view(), name="quote_bulk_delete"),
    path("quotes/from-cad/", SaveCadAndCreateQuoteView.as_view(), name="quote_from_cad"),
    path("quotes/<str:quote_id>/", QuoteDetailView.as_view(), name="quote_detail"),
    path("quotes/<str:quote_id>/duplicate/", QuoteDuplicateView.as_view(), name="quote_duplicate"),
]
