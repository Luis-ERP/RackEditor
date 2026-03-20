import uuid
from datetime import datetime, timezone

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Quote, QuoteLineItem
from .services import DesignRevisionQuoteError, DesignRevisionQuoteService
from .serializers import QuoteSerializer, QuoteListSerializer


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


class QuoteListView(APIView):
    """
    GET /api/quotes/
    Returns a paginated list of quotes for the authenticated user.
    Query params:
      - search: filter by quoteNumber or clientRef name (case-insensitive)
      - status: filter by status (DRAFT, SENT, APPROVED, REJECTED, CANCELLED)
      - page: page number (default 1)
      - page_size: items per page (default 20, max 100)
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        queryset = Quote.objects.all().order_by("-audit__createdAt")

        search = request.query_params.get("search", "").strip()
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(quoteNumber__icontains=search) |
                Q(clientRef__name__icontains=search)
            )

        status_filter = request.query_params.get("status", "").strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())

        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (ValueError, TypeError):
            page = 1

        try:
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
        except (ValueError, TypeError):
            page_size = 20

        total = queryset.count()
        offset = (page - 1) * page_size
        quotes = queryset[offset: offset + page_size]

        serializer = QuoteListSerializer(quotes, many=True)
        return Response({
            "count": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": max(1, (total + page_size - 1) // page_size),
            "results": serializer.data,
        })


class QuoteDetailView(APIView):
    """
    GET  /api/quotes/<id>/   — fetch a single quote with line items
    DELETE /api/quotes/<id>/ — delete a quote
    """

    permission_classes = [permissions.AllowAny]

    def _get_quote(self, quote_id):
        try:
            return Quote.objects.get(id=quote_id)
        except Quote.DoesNotExist:
            return None

    def get(self, request, quote_id):
        quote = self._get_quote(quote_id)
        if not quote:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = QuoteSerializer(quote)
        return Response(serializer.data)

    def delete(self, request, quote_id):
        quote = self._get_quote(quote_id)
        if not quote:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        quote.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class QuoteDuplicateView(APIView):
    """
    POST /api/quotes/<id>/duplicate/
    Creates a copy of the quote with a new id/number and DRAFT status.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request, quote_id):
        try:
            original = Quote.objects.get(id=quote_id)
        except Quote.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        now = _now_iso()
        created_by = request.user.email or str(request.user.pk)
        new_id = str(uuid.uuid4())
        new_number = f"COPY-{original.quoteNumber}"

        duplicate = Quote(
            id=new_id,
            quoteNumber=new_number,
            status="DRAFT",
            clientRef=original.clientRef,
            linkedDesign=original.linkedDesign,
            subtotal=original.subtotal,
            shipping=original.shipping,
            freight=original.freight,
            discount=original.discount,
            discountAmount=original.discountAmount,
            taxRate=original.taxRate,
            taxAmount=original.taxAmount,
            total=original.total,
            audit={"createdAt": now, "createdBy": created_by, "updatedAt": now, "updatedBy": created_by},
            extras=original.extras,
        )
        duplicate.save()

        for item in original.lineItems.all():
            QuoteLineItem(
                id=str(uuid.uuid4()),
                quote=duplicate,
                name=item.name,
                description=item.description,
                source=item.source,
                traceability=item.traceability,
                catalogRef=item.catalogRef,
                cost=item.cost,
                marginRate=item.marginRate,
                price=item.price,
                quantity=item.quantity,
                discount=item.discount,
                discountAmount=item.discountAmount,
                total=item.total,
                isReadOnlyFromCad=item.isReadOnlyFromCad,
                isDesignLinked=item.isDesignLinked,
                audit={"createdAt": now, "createdBy": created_by, "updatedAt": now, "updatedBy": created_by},
                extras=item.extras,
            ).save()

        serializer = QuoteListSerializer(duplicate)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class QuoteBulkDeleteView(APIView):
    """
    DELETE /api/quotes/bulk/
    Body: {"ids": ["<id1>", "<id2>", ...]}
    Deletes all matching quotes and returns the count deleted.
    """

    permission_classes = [permissions.AllowAny]

    def delete(self, request):
        ids = request.data.get("ids", [])
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list."}, status=status.HTTP_400_BAD_REQUEST)
        deleted_count, _ = Quote.objects.filter(id__in=ids).delete()
        return Response({"deleted": deleted_count})


class SaveCadAndCreateQuoteView(APIView):
    """
    POST /api/quotes/from-cad/

    Accepts the CAD editor export payload, persists a Quote with CAD-linked
    QuoteLineItems derived from the BOM snapshot, and returns the created quote.

    Request body (mirrors cadQuoteExporter.buildCadToQuotePayload):
    {
        "source": "CAD_EDITOR",
        "exportedAt": "<ISO8601>",
        "designId": "cad-live-design",
        "designRevisionId": "cad-revision-<timestamp>",
        "quoteNumber": "QTE-CAD-...",
        "bomSnapshot": {
            "items": [{"sku": "...", "name": "...", "quantity": 5, "unit": "ea", "rule": "..."}],
            "catalogVersion": "rack-catalog-lists-v1",
            "generatedAt": "<ISO8601>"
        },
        "projectDocument": { ... },
        "stats": { "lineCount": 3, "totalQuantity": 15 }
    }
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            quote = DesignRevisionQuoteService.create_quote_from_payload(request.data, actor=request.user)
        except DesignRevisionQuoteError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = QuoteSerializer(quote)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
