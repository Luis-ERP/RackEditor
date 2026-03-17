import uuid
from datetime import datetime, timezone

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Quote, QuoteLineItem
from .serializers import QuoteSerializer


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _build_line_items_from_bom(quote, bom_snapshot, created_by):
    """Create QuoteLineItem rows from a BOM snapshot."""
    items = bom_snapshot.get("items", [])
    bom_generated_at = bom_snapshot.get("generatedAt", _now_iso())
    catalog_version = bom_snapshot.get("catalogVersion", "")
    now = _now_iso()

    line_items = []
    for item in items:
        sku = item.get("sku", "")
        name = item.get("name", sku)
        quantity = item.get("quantity", 1)
        rule = item.get("rule", "")

        line_item = QuoteLineItem(
            id=str(uuid.uuid4()),
            quote=quote,
            name=name,
            description="",
            source="CAD_BOM",
            traceability={
                "bomGeneratedAt": bom_generated_at,
                "catalogVersion": catalog_version,
            },
            catalogRef={"sku": sku, "name": name, "rule": rule},
            cost=0,
            marginRate=0.20,
            price=0,
            quantity=quantity,
            discount={"kind": "NONE", "value": 0},
            discountAmount=0,
            total=0,
            isReadOnlyFromCad=True,
            isDesignLinked=True,
            audit={"createdAt": now, "createdBy": created_by, "updatedAt": now, "updatedBy": created_by},
            extras={},
        )
        line_items.append(line_item)

    return line_items


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

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data

        bom_snapshot = data.get("bomSnapshot")
        if not bom_snapshot or not isinstance(bom_snapshot.get("items"), list):
            return Response(
                {"detail": "bomSnapshot.items is required and must be a list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not bom_snapshot["items"]:
            return Response(
                {"detail": "bomSnapshot.items must not be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exported_at = data.get("exportedAt", _now_iso())
        design_id = data.get("designId", "cad-live-design")
        design_revision_id = data.get("designRevisionId", f"cad-revision-{exported_at}")
        quote_number = data.get("quoteNumber", f"QTE-CAD-{uuid.uuid4().hex[:8].upper()}")
        project_document = data.get("projectDocument")
        now = _now_iso()

        created_by = request.user.email or str(request.user.pk)

        quote = Quote(
            id=str(uuid.uuid4()),
            quoteNumber=quote_number,
            status="DRAFT",
            clientRef=None,
            linkedDesign={
                "designId": design_id,
                "designRevisionId": design_revision_id,
                "source": "CAD_EDITOR",
                "exportedAt": exported_at,
                "bomGeneratedAt": bom_snapshot.get("generatedAt", now),
                "catalogVersion": bom_snapshot.get("catalogVersion", ""),
                "projectDocument": project_document,
            },
            subtotal=0,
            shipping=0,
            freight=0,
            discount={"kind": "NONE", "value": 0},
            discountAmount=0,
            taxRate=0.16,
            taxAmount=0,
            total=0,
            audit={"createdAt": now, "createdBy": created_by, "updatedAt": now, "updatedBy": created_by},
            extras={},
        )
        quote.save()

        line_items = _build_line_items_from_bom(quote, bom_snapshot, created_by)
        QuoteLineItem.objects.bulk_create(line_items)

        serializer = QuoteSerializer(quote)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
