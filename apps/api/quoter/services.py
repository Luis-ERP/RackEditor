import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import transaction

from cad.catalog import lookup_sku
from cad.models import DesignRevision

from .models import DISCOUNT_KIND_CHOICES, Quote, QuoteLineItem


CENT_AMOUNT = Decimal("0.01")
DEFAULT_MARGIN_RATE = Decimal("0.20")
DEFAULT_TAX_RATE = Decimal("0.16")
DEFAULT_DISCOUNT = {"kind": "NONE", "value": 0}
SUPPORTED_DISCOUNT_KINDS = {kind for kind, _label in DISCOUNT_KIND_CHOICES}


class DesignRevisionQuoteError(ValueError):
    pass


class DesignRevisionQuoteService:
    @classmethod
    def create_quote_from_payload(cls, payload, *, actor=None):
        normalized = cls._normalize_payload(payload, require_project_document=True)
        return cls._create_quote(normalized, actor=actor)

    @classmethod
    def create_quote_from_design_revision(cls, design_revision, *, actor=None, quote_number=""):
        normalized = cls._normalize_payload(
            cls._payload_from_design_revision(design_revision, quote_number=quote_number),
            require_project_document=False,
        )
        return cls._create_quote(normalized, actor=actor)

    @classmethod
    def sync_quote_from_payload(cls, quote, payload, *, actor=None):
        normalized = cls._normalize_payload(payload, require_project_document=True)
        return cls._sync_quote(quote, normalized, actor=actor)

    @classmethod
    def sync_quote_from_design_revision(cls, quote, design_revision, *, actor=None):
        normalized = cls._normalize_payload(
            cls._payload_from_design_revision(design_revision, quote_number=quote.quoteNumber),
            require_project_document=False,
        )
        return cls._sync_quote(quote, normalized, actor=actor)

    @classmethod
    def add_manual_line_item(
        cls,
        quote,
        *,
        name,
        cost,
        actor=None,
        description="",
        quantity=1,
        margin_rate=DEFAULT_MARGIN_RATE,
        discount=None,
        extras=None,
    ):
        actor_id = cls._resolve_actor(actor)
        line_item = cls._build_line_item(
            quote=quote,
            name=name,
            description=description,
            cost=cost,
            margin_rate=margin_rate,
            quantity=quantity,
            discount=discount,
            source="MANUAL",
            traceability=None,
            catalog_ref=None,
            is_read_only_from_cad=False,
            is_design_linked=False,
            created_by=actor_id,
            extras=extras,
        )

        with transaction.atomic():
            line_item.save()
            quote.audit = cls._updated_audit(quote.audit, actor_id)
            quote.save(update_fields=["audit"])
            cls.recalculate_quote_totals(quote)

        return line_item

    @classmethod
    def update_line_item(cls, quote, line_item_id, updates, *, actor=None, allow_cad_overrides=False):
        try:
            line_item = quote.lineItems.get(id=line_item_id)
        except QuoteLineItem.DoesNotExist as exc:
            raise DesignRevisionQuoteError("Quote line item was not found.") from exc

        if line_item.isReadOnlyFromCad and not allow_cad_overrides:
            raise DesignRevisionQuoteError("CAD linked line items are read-only and cannot be edited.")

        actor_id = cls._resolve_actor(actor)
        next_discount = updates.get("discount", line_item.discount)

        updated_line_item = cls._build_line_item(
            quote=quote,
            name=updates.get("name", line_item.name),
            description=updates.get("description", line_item.description),
            cost=updates.get("cost", line_item.cost),
            margin_rate=updates.get("marginRate", line_item.marginRate),
            quantity=updates.get("quantity", line_item.quantity),
            discount=next_discount,
            source=line_item.source,
            traceability=line_item.traceability,
            catalog_ref=line_item.catalogRef,
            is_read_only_from_cad=line_item.isReadOnlyFromCad,
            is_design_linked=line_item.isDesignLinked,
            created_by=(line_item.audit or {}).get("createdBy"),
            extras=updates.get("extras", line_item.extras),
            line_item_id=line_item.id,
            created_at=(line_item.audit or {}).get("createdAt"),
            updated_by=actor_id,
        )

        with transaction.atomic():
            for field_name in [
                "name",
                "description",
                "cost",
                "marginRate",
                "price",
                "quantity",
                "discount",
                "discountAmount",
                "total",
                "audit",
                "extras",
            ]:
                setattr(line_item, field_name, getattr(updated_line_item, field_name))
            line_item.save(
                update_fields=[
                    "name",
                    "description",
                    "cost",
                    "marginRate",
                    "price",
                    "quantity",
                    "discount",
                    "discountAmount",
                    "total",
                    "audit",
                    "extras",
                ]
            )
            quote.audit = cls._updated_audit(quote.audit, actor_id)
            quote.save(update_fields=["audit"])
            cls.recalculate_quote_totals(quote)

        return line_item

    @classmethod
    def remove_line_item(cls, quote, line_item_id, *, actor=None):
        try:
            line_item = quote.lineItems.get(id=line_item_id)
        except QuoteLineItem.DoesNotExist as exc:
            raise DesignRevisionQuoteError("Quote line item was not found.") from exc

        if line_item.isDesignLinked:
            raise DesignRevisionQuoteError("Cannot remove CAD-generated line item.")

        actor_id = cls._resolve_actor(actor)

        with transaction.atomic():
            line_item.delete()
            quote.audit = cls._updated_audit(quote.audit, actor_id)
            quote.save(update_fields=["audit"])
            cls.recalculate_quote_totals(quote)

        return quote

    @classmethod
    def recalculate_quote_totals(cls, quote):
        subtotal = cls._round_money(
            sum((line_item.total for line_item in quote.lineItems.all()), Decimal("0"))
        )
        shipping = cls._money_value(quote.shipping, field_name="shipping")
        freight = cls._money_value(quote.freight, field_name="freight")
        tax_rate = cls._decimal_value(quote.taxRate, field_name="taxRate", minimum=Decimal("0"))
        discount = cls._normalize_discount(quote.discount)

        pre_tax_base = cls._round_money(subtotal + shipping + freight)
        discount_amount = cls._compute_discount_amount(pre_tax_base, discount)
        taxable_base = cls._round_money(max(Decimal("0"), pre_tax_base - discount_amount))
        tax_amount = cls._round_money(taxable_base * tax_rate)
        total = cls._round_money(taxable_base + tax_amount)

        quote.subtotal = subtotal
        quote.discountAmount = discount_amount
        quote.taxAmount = tax_amount
        quote.total = total
        quote.save(update_fields=["subtotal", "discountAmount", "taxAmount", "total"])
        return quote

    @classmethod
    def _create_quote(cls, normalized, *, actor=None):
        actor_id = cls._resolve_actor(actor)
        now = cls._now_iso()
        quote = Quote(
            id=str(uuid.uuid4()),
            quoteNumber=normalized["quote_number"],
            status="DRAFT",
            clientRef=None,
            linkedDesign=cls._build_linked_design(normalized),
            subtotal=0,
            shipping=0,
            freight=0,
            discount=DEFAULT_DISCOUNT,
            discountAmount=0,
            taxRate=DEFAULT_TAX_RATE,
            taxAmount=0,
            total=0,
            audit=cls._new_audit(created_by=actor_id, updated_by=actor_id, created_at=now, updated_at=now),
            extras={},
        )
        line_items = cls._build_cad_line_items(quote, normalized, actor_id)

        with transaction.atomic():
            quote.save()
            QuoteLineItem.objects.bulk_create(line_items)
            cls.recalculate_quote_totals(quote)

        return quote

    @classmethod
    def _sync_quote(cls, quote, normalized, *, actor=None):
        actor_id = cls._resolve_actor(actor)
        line_items = cls._build_cad_line_items(quote, normalized, actor_id)

        with transaction.atomic():
            quote.lineItems.filter(isDesignLinked=True).delete()
            QuoteLineItem.objects.bulk_create(line_items)
            quote.linkedDesign = cls._build_linked_design(normalized)
            quote.audit = cls._updated_audit(quote.audit, actor_id)
            quote.save(update_fields=["linkedDesign", "audit"])
            cls.recalculate_quote_totals(quote)

        return quote

    @classmethod
    def _build_cad_line_items(cls, quote, normalized, actor_id):
        bom_snapshot = normalized["bom_snapshot"]
        line_items = []
        for index, item in enumerate(bom_snapshot["items"]):
            sku = item["sku"]
            quantity = cls._quantity_value(item["quantity"], field_name=f"bomSnapshot.items[{index}].quantity")
            name = item.get("name") or sku
            unit = str(item.get("unit") or "ea")
            rule = item.get("rule")
            description = str(item.get("description") or f"{name} | SKU {sku} | Unit {unit}")
            catalog_entry = lookup_sku(sku)
            matched = catalog_entry is not None
            cost = cls._money_value(catalog_entry["cost"] if matched else 0, field_name=f"catalog cost for {sku}")

            line_items.append(
                cls._build_line_item(
                    quote=quote,
                    name=name,
                    description=description,
                    cost=cost,
                    margin_rate=DEFAULT_MARGIN_RATE,
                    quantity=quantity,
                    discount=DEFAULT_DISCOUNT,
                    source="CAD_BOM",
                    traceability={
                        "bomLineIndex": index,
                        "bomGeneratedAt": bom_snapshot.get("generatedAt"),
                        "catalogVersion": bom_snapshot.get("catalogVersion"),
                        "sku": sku,
                        "rule": rule,
                        "designId": normalized["design_id"],
                        "designRevisionId": normalized["design_revision_id"],
                    },
                    catalog_ref={
                        "sku": sku,
                        "name": name,
                        "rule": rule,
                        "matched": matched,
                        "catalogVersion": bom_snapshot.get("catalogVersion"),
                        "source": "core/rack/catalog_lists",
                        **({"catalogCost": float(cost)} if matched else {}),
                    },
                    is_read_only_from_cad=True,
                    is_design_linked=True,
                    created_by=actor_id,
                    extras={
                        "bomGeneratedAt": bom_snapshot.get("generatedAt"),
                        "unit": unit,
                    },
                )
            )
        return line_items

    @classmethod
    def _build_line_item(
        cls,
        *,
        quote,
        name,
        description,
        cost,
        margin_rate,
        quantity,
        discount,
        source,
        traceability,
        catalog_ref,
        is_read_only_from_cad,
        is_design_linked,
        created_by,
        extras,
        line_item_id=None,
        created_at=None,
        updated_by=None,
    ):
        if not isinstance(name, str) or not name.strip():
            raise DesignRevisionQuoteError("Quote line item name is required.")

        if source not in {"CAD_BOM", "MANUAL"}:
            raise DesignRevisionQuoteError(f"Unsupported quote line item source: {source}")

        safe_cost = cls._money_value(cost, field_name="line item cost")
        safe_margin_rate = cls._decimal_value(margin_rate, field_name="line item marginRate", minimum=Decimal("0"))
        safe_quantity = cls._quantity_value(quantity, field_name="line item quantity")
        normalized_discount = cls._normalize_discount(discount)

        price = cls._round_money(safe_cost * (Decimal("1") + safe_margin_rate))
        line_base_total = cls._round_money(price * safe_quantity)
        discount_amount = cls._compute_discount_amount(line_base_total, normalized_discount)
        total = cls._round_money(max(Decimal("0"), line_base_total - discount_amount))
        now = cls._now_iso()

        return QuoteLineItem(
            id=line_item_id or str(uuid.uuid4()),
            quote=quote,
            name=name.strip(),
            description=description or "",
            source=source,
            traceability=traceability,
            catalogRef=catalog_ref,
            cost=safe_cost,
            marginRate=safe_margin_rate,
            price=price,
            quantity=safe_quantity,
            discount=normalized_discount,
            discountAmount=discount_amount,
            total=total,
            isReadOnlyFromCad=bool(is_read_only_from_cad),
            isDesignLinked=bool(is_design_linked),
            audit=cls._new_audit(
                created_by=created_by,
                updated_by=updated_by or created_by,
                created_at=created_at or now,
                updated_at=now,
            ),
            extras=cls._normalize_json_object(extras, field_name="line item extras"),
        )

    @classmethod
    def _normalize_payload(cls, payload, *, require_project_document):
        if not hasattr(payload, "get"):
            raise DesignRevisionQuoteError("Quote translation payload must be an object.")

        exported_at = payload.get("exportedAt") or cls._now_iso()
        design_id = payload.get("designId") or "cad-live-design"
        design_revision_id = payload.get("designRevisionId") or f"cad-revision-{exported_at}"
        quote_number = payload.get("quoteNumber") or cls._build_quote_number(exported_at)
        bom_snapshot = payload.get("bomSnapshot")
        project_document = payload.get("projectDocument")
        source = payload.get("source") or "CAD_EDITOR"

        if not isinstance(design_id, str) or not design_id.strip():
            raise DesignRevisionQuoteError("designId must be a non-empty string.")
        if not isinstance(design_revision_id, str) or not design_revision_id.strip():
            raise DesignRevisionQuoteError("designRevisionId must be a non-empty string.")
        if not isinstance(quote_number, str) or not quote_number.strip():
            raise DesignRevisionQuoteError("quoteNumber must be a non-empty string.")
        if not isinstance(source, str) or not source.strip():
            raise DesignRevisionQuoteError("source must be a non-empty string.")

        cls._validate_bom_snapshot(bom_snapshot)
        normalized_project_document = cls._normalize_project_document(
            project_document,
            required=require_project_document,
        )

        return {
            "exported_at": str(exported_at),
            "design_id": design_id.strip(),
            "design_revision_id": design_revision_id.strip(),
            "quote_number": quote_number.strip(),
            "bom_snapshot": bom_snapshot,
            "project_document": normalized_project_document,
            "source": source.strip(),
        }

    @classmethod
    def _payload_from_design_revision(cls, design_revision, *, quote_number=""):
        if not isinstance(design_revision, DesignRevision):
            raise DesignRevisionQuoteError("design_revision must be a DesignRevision instance.")

        submission = {}
        if isinstance(design_revision.validationResults, dict):
            submission = design_revision.validationResults.get("submission") or {}

        exported_at = submission.get("exportedAt") or design_revision.createdAt.isoformat()
        design_id = submission.get("designId") or "cad-live-design"
        source = submission.get("source") or "CAD_EDITOR"

        return {
            "source": source,
            "exportedAt": exported_at,
            "designId": design_id,
            "designRevisionId": design_revision.id,
            "quoteNumber": quote_number or cls._build_quote_number(exported_at),
            "bomSnapshot": design_revision.bomSnapshot,
            "projectDocument": design_revision.projectDocument,
        }

    @classmethod
    def _validate_bom_snapshot(cls, bom_snapshot):
        if not isinstance(bom_snapshot, dict):
            raise DesignRevisionQuoteError("bomSnapshot is required and must be an object.")

        items = bom_snapshot.get("items")
        if not isinstance(items, list):
            raise DesignRevisionQuoteError("bomSnapshot.items is required and must be a list.")
        if not items:
            raise DesignRevisionQuoteError("bomSnapshot.items must not be empty.")

        for index, item in enumerate(items):
            if not isinstance(item, dict):
                raise DesignRevisionQuoteError(f"bomSnapshot.items[{index}] must be an object.")

            sku = item.get("sku")
            if not isinstance(sku, str) or not sku.strip():
                raise DesignRevisionQuoteError(f"bomSnapshot.items[{index}].sku is required.")

            cls._quantity_value(item.get("quantity"), field_name=f"bomSnapshot.items[{index}].quantity")

    @classmethod
    def _normalize_project_document(cls, project_document, *, required):
        if project_document is None:
            if required:
                raise DesignRevisionQuoteError("projectDocument is required and must be an object.")
            return None
        if not isinstance(project_document, dict):
            raise DesignRevisionQuoteError("projectDocument must be an object.")
        return project_document

    @classmethod
    def _build_linked_design(cls, normalized):
        bom_snapshot = normalized["bom_snapshot"]
        return {
            "designId": normalized["design_id"],
            "designRevisionId": normalized["design_revision_id"],
            "source": normalized["source"],
            "exportedAt": normalized["exported_at"],
            "bomGeneratedAt": bom_snapshot.get("generatedAt"),
            "catalogVersion": bom_snapshot.get("catalogVersion"),
            "projectDocument": normalized["project_document"],
        }

    @classmethod
    def _normalize_discount(cls, discount):
        candidate = discount or DEFAULT_DISCOUNT
        if not isinstance(candidate, dict):
            raise DesignRevisionQuoteError("discount must be an object.")

        kind = candidate.get("kind") or "NONE"
        value = cls._decimal_value(candidate.get("value", 0), field_name="discount.value", minimum=Decimal("0"))
        if kind not in SUPPORTED_DISCOUNT_KINDS:
            raise DesignRevisionQuoteError(f"Unsupported discount kind: {kind}")
        if kind == "PERCENTAGE" and value > Decimal("100"):
            raise DesignRevisionQuoteError("Percentage discount cannot exceed 100.")
        return {"kind": kind, "value": float(value) if value % 1 else int(value)}

    @classmethod
    def _compute_discount_amount(cls, base_amount, discount):
        normalized_discount = cls._normalize_discount(discount)
        safe_base = cls._money_value(base_amount, field_name="discount base amount")
        kind = normalized_discount["kind"]
        value = cls._decimal_value(normalized_discount["value"], field_name="discount.value", minimum=Decimal("0"))

        if kind == "NONE" or value == 0:
            return Decimal("0.00")
        if kind == "PERCENTAGE":
            return cls._round_money(safe_base * (value / Decimal("100")))
        return cls._round_money(min(safe_base, value))

    @classmethod
    def _new_audit(cls, *, created_by, updated_by, created_at, updated_at):
        return {
            "createdAt": created_at,
            "updatedAt": updated_at,
            "createdBy": created_by,
            "updatedBy": updated_by,
        }

    @classmethod
    def _updated_audit(cls, audit, actor_id):
        current = audit if isinstance(audit, dict) else {}
        return {
            "createdAt": current.get("createdAt") or cls._now_iso(),
            "updatedAt": cls._now_iso(),
            "createdBy": current.get("createdBy"),
            "updatedBy": actor_id,
        }

    @classmethod
    def _normalize_json_object(cls, value, *, field_name):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise DesignRevisionQuoteError(f"{field_name} must be an object.")
        return value

    @classmethod
    def _money_value(cls, value, *, field_name):
        return cls._decimal_value(value, field_name=field_name, minimum=Decimal("0"), quantize_to=CENT_AMOUNT)

    @classmethod
    def _quantity_value(cls, value, *, field_name):
        return cls._decimal_value(value, field_name=field_name, minimum=Decimal("0.01"), quantize_to=CENT_AMOUNT)

    @classmethod
    def _decimal_value(cls, value, *, field_name, minimum, quantize_to=None):
        try:
            decimal_value = Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise DesignRevisionQuoteError(f"{field_name} must be a finite number.") from exc

        if not decimal_value.is_finite():
            raise DesignRevisionQuoteError(f"{field_name} must be a finite number.")
        if decimal_value < minimum:
            comparator = "positive" if minimum > 0 else "non-negative"
            raise DesignRevisionQuoteError(f"{field_name} must be a {comparator} number.")
        if quantize_to is not None:
            return decimal_value.quantize(quantize_to, rounding=ROUND_HALF_UP)
        return decimal_value

    @classmethod
    def _round_money(cls, value):
        return Decimal(value).quantize(CENT_AMOUNT, rounding=ROUND_HALF_UP)

    @classmethod
    def _resolve_actor(cls, actor):
        if isinstance(actor, str) and actor.strip():
            return actor.strip()
        if actor is None:
            return "system"
        if getattr(actor, "is_authenticated", False):
            email = getattr(actor, "email", None)
            if isinstance(email, str) and email.strip():
                return email.strip()
            if getattr(actor, "pk", None) is not None:
                return str(actor.pk)
        return "system"

    @staticmethod
    def _build_quote_number(exported_at):
        timestamp = str(exported_at).replace("-", "").replace(":", "").replace(".", "")
        return f"QTE-CAD-{timestamp[:14]}"

    @staticmethod
    def _now_iso():
        return datetime.now(timezone.utc).isoformat()