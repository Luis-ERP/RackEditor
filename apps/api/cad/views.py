from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DesignRevision
from .serializers import DesignRevisionSerializer
from quoter.models import Quote
from quoter.services import DesignRevisionQuoteError, DesignRevisionQuoteService


class DesignRevisionSubmitView(APIView):
	"""
	POST /api/cad/design-revisions/

	Persists a submitted CAD design revision using the frontend export payload.
	The current client sends the project document and BOM snapshot together with
	submission metadata. The raw project document is stored so the design can be
	recovered later without lossy reconstruction.
	"""

	permission_classes = [permissions.AllowAny]

	def post(self, request):
		data = request.data
		bom_snapshot = data.get("bomSnapshot")
		project_document = data.get("projectDocument")
		design_revision_id = data.get("designRevisionId")

		if not design_revision_id or not isinstance(design_revision_id, str):
			return Response(
				{"detail": "designRevisionId is required."},
				status=status.HTTP_400_BAD_REQUEST,
			)

		if not isinstance(project_document, dict):
			return Response(
				{"detail": "projectDocument is required and must be an object."},
				status=status.HTTP_400_BAD_REQUEST,
			)

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

		if DesignRevision.objects.filter(id=design_revision_id).exists():
			return Response(
				{"detail": "A design revision with this id already exists."},
				status=status.HTTP_409_CONFLICT,
			)

		with transaction.atomic():
			design_revision = DesignRevision.objects.create(
				id=design_revision_id,
				revisionNumber=1,
				catalogVersion=bom_snapshot.get("catalogVersion", ""),
				validationResults={
					"submission": {
						"source": data.get("source", "CAD_EDITOR"),
						"designId": data.get("designId", "cad-live-design"),
						"exportedAt": data.get("exportedAt"),
						"stats": data.get("stats", {}),
					}
				},
				bomSnapshot=bom_snapshot,
				projectDocument=project_document,
			)

			quote = Quote.objects.filter(linkedDesign__designRevisionId=design_revision_id).first()
			try:
				if quote:
					DesignRevisionQuoteService.sync_quote_from_design_revision(
						quote,
						design_revision,
						actor=request.user,
					)
				else:
					DesignRevisionQuoteService.create_quote_from_design_revision(
						design_revision,
						actor=request.user,
						quote_number=(data.get("quoteNumber") or "").strip(),
					)
			except DesignRevisionQuoteError as exc:
				transaction.set_rollback(True)
				return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

		serializer = DesignRevisionSerializer(design_revision)
		return Response(serializer.data, status=status.HTTP_201_CREATED)
