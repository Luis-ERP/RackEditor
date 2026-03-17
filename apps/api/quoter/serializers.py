from rest_framework import serializers

from .models import Quote, QuoteLineItem


class QuoteLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuoteLineItem
        fields = [
            "id",
            "name",
            "description",
            "source",
            "traceability",
            "catalogRef",
            "cost",
            "marginRate",
            "price",
            "quantity",
            "discount",
            "discountAmount",
            "total",
            "isReadOnlyFromCad",
            "isDesignLinked",
            "audit",
            "extras",
        ]


class QuoteSerializer(serializers.ModelSerializer):
    lineItems = QuoteLineItemSerializer(many=True, read_only=True)

    class Meta:
        model = Quote
        fields = [
            "id",
            "quoteNumber",
            "status",
            "clientRef",
            "linkedDesign",
            "lineItems",
            "subtotal",
            "shipping",
            "freight",
            "discount",
            "discountAmount",
            "taxRate",
            "taxAmount",
            "total",
            "audit",
            "extras",
        ]
