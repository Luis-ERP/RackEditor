from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from cad.models import DesignRevision

from .models import Quote, QuoteLineItem
from .services import DesignRevisionQuoteError, DesignRevisionQuoteService


class DesignRevisionQuoteServiceTests(APITestCase):
	maxDiff = None

	def build_payload(self, **overrides):
		payload = {
			"source": "CAD_EDITOR",
			"exportedAt": "2026-03-19T12:00:00Z",
			"designId": "cad-live-design",
			"designRevisionId": "cad-revision-2026-03-19T12:00:00Z",
			"quoteNumber": "QTE-CAD-20260319120000",
			"bomSnapshot": {
				"catalogVersion": "rack-catalog-lists-v1",
				"generatedAt": "2026-03-19T12:00:00Z",
				"items": [
					{
						"sku": "frame-96in-36in-36in-g14",
						"name": "Frame 96 x 36",
						"quantity": 1,
						"unit": "ea",
						"rule": "FRAME",
					},
					{
						"sku": "beam-16g-96in-3.5in",
						"name": "Beam 96 x 3.5",
						"quantity": 2,
						"unit": "ea",
						"rule": "BEAM_PAIR",
					},
				],
			},
			"projectDocument": {
				"documentType": "rack-editor-project",
				"schemaVersion": "1.0.0",
			},
			"stats": {"lineCount": 2, "totalQuantity": 3},
		}
		payload.update(overrides)
		return payload

	def build_design_revision(self, revision_id, bom_items, project_document=None):
		return DesignRevision.objects.create(
			id=revision_id,
			revisionNumber=1,
			catalogVersion="rack-catalog-lists-v1",
			validationResults={
				"submission": {
					"source": "CAD_EDITOR",
					"designId": "cad-live-design",
					"exportedAt": "2026-03-19T12:00:00Z",
				}
			},
			bomSnapshot={
				"catalogVersion": "rack-catalog-lists-v1",
				"generatedAt": "2026-03-19T12:00:00Z",
				"items": bom_items,
			},
			projectDocument=project_document or {"documentType": "rack-editor-project"},
		)

	def test_create_quote_from_payload_builds_design_linked_lines_and_totals(self):
		quote = DesignRevisionQuoteService.create_quote_from_payload(self.build_payload(), actor="tester@example.com")

		self.assertEqual(quote.quoteNumber, "QTE-CAD-20260319120000")
		self.assertEqual(quote.linkedDesign["designRevisionId"], "cad-revision-2026-03-19T12:00:00Z")
		self.assertEqual(quote.lineItems.count(), 2)

		frame_line = quote.lineItems.get(catalogRef__sku="frame-96in-36in-36in-g14")
		beam_line = quote.lineItems.get(catalogRef__sku="beam-16g-96in-3.5in")

		self.assertTrue(frame_line.isDesignLinked)
		self.assertTrue(frame_line.isReadOnlyFromCad)
		self.assertEqual(frame_line.traceability["designRevisionId"], "cad-revision-2026-03-19T12:00:00Z")
		self.assertEqual(frame_line.total, Decimal("1661.16"))
		self.assertEqual(beam_line.total, Decimal("1116.48"))
		self.assertEqual(quote.subtotal, Decimal("2777.64"))
		self.assertEqual(quote.discountAmount, Decimal("0.00"))
		self.assertEqual(quote.taxAmount, Decimal("444.42"))
		self.assertEqual(quote.total, Decimal("3222.06"))

	def test_sync_quote_from_design_revision_replaces_cad_lines_and_preserves_manual_lines(self):
		initial_revision = self.build_design_revision(
			revision_id="revision-1",
			bom_items=[
				{
					"sku": "beam-16g-96in-3.5in",
					"name": "Beam 96 x 3.5",
					"quantity": 2,
					"unit": "ea",
					"rule": "BEAM_PAIR",
				}
			],
		)
		quote = DesignRevisionQuoteService.create_quote_from_design_revision(initial_revision, actor="designer@example.com")
		manual_line = DesignRevisionQuoteService.add_manual_line_item(
			quote,
			name="Installation",
			description="On-site labor",
			cost=100,
			quantity=1,
			margin_rate=Decimal("0.50"),
			actor="seller@example.com",
		)

		next_revision = self.build_design_revision(
			revision_id="revision-2",
			bom_items=[
				{
					"sku": "frame-96in-36in-36in-g14",
					"name": "Frame 96 x 36",
					"quantity": 1,
					"unit": "ea",
					"rule": "FRAME",
				}
			],
		)

		DesignRevisionQuoteService.sync_quote_from_design_revision(quote, next_revision, actor="seller@example.com")

		quote.refresh_from_db()
		self.assertEqual(quote.linkedDesign["designRevisionId"], "revision-2")
		self.assertEqual(quote.lineItems.count(), 2)
		self.assertTrue(quote.lineItems.filter(id=manual_line.id).exists())
		self.assertEqual(quote.lineItems.filter(isDesignLinked=True).count(), 1)
		self.assertEqual(quote.subtotal, Decimal("1811.16"))
		self.assertEqual(quote.taxAmount, Decimal("289.79"))
		self.assertEqual(quote.total, Decimal("2100.95"))

	def test_remove_line_item_rejects_cad_generated_rows(self):
		quote = DesignRevisionQuoteService.create_quote_from_payload(self.build_payload(), actor="tester@example.com")
		cad_line_item = quote.lineItems.filter(isDesignLinked=True).first()

		with self.assertRaisesMessage(DesignRevisionQuoteError, "Cannot remove CAD-generated line item."):
			DesignRevisionQuoteService.remove_line_item(quote, cad_line_item.id, actor="tester@example.com")

	def test_create_quote_from_payload_rejects_invalid_bom_item(self):
		payload = self.build_payload()
		payload["bomSnapshot"]["items"][0]["sku"] = ""

		with self.assertRaisesMessage(DesignRevisionQuoteError, "bomSnapshot.items[0].sku is required."):
			DesignRevisionQuoteService.create_quote_from_payload(payload, actor="tester@example.com")

	def test_quote_from_cad_endpoint_uses_service_contract(self):
		response = self.client.post(reverse("quote_from_cad"), self.build_payload(), format="json")

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(Quote.objects.count(), 1)
		quote = Quote.objects.get()
		self.assertEqual(response.data["id"], quote.id)
		self.assertEqual(response.data["linkedDesign"]["designRevisionId"], "cad-revision-2026-03-19T12:00:00Z")
		self.assertEqual(len(response.data["lineItems"]), 2)
		self.assertEqual(QuoteLineItem.objects.filter(quote=quote, isDesignLinked=True).count(), 2)

	def test_quote_from_cad_endpoint_returns_validation_errors(self):
		payload = self.build_payload(projectDocument=None)

		response = self.client.post(reverse("quote_from_cad"), payload, format="json")

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertEqual(response.data["detail"], "projectDocument is required and must be an object.")
