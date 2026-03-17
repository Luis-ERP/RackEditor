from django.contrib import admin

from .models import Quote, QuoteLineItem


@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = ("id", "quoteNumber", "status", "subtotal", "discountAmount", "taxAmount", "total")
    search_fields = ("id", "quoteNumber", "status")
    list_filter = ("status",)


@admin.register(QuoteLineItem)
class QuoteLineItemAdmin(admin.ModelAdmin):
    list_display = ("id", "quote", "name", "source", "quantity", "price", "total", "isReadOnlyFromCad", "isDesignLinked")
    search_fields = ("id", "quote__id", "quote__quoteNumber", "name")
    list_filter = ("source", "isReadOnlyFromCad", "isDesignLinked")
