from django.db import models

DISCOUNT_KIND_CHOICES = [
    ("NONE", "NONE"),
    ("PERCENTAGE", "PERCENTAGE"),
    ("FIXED_AMOUNT", "FIXED_AMOUNT"),
]

QUOTE_LINE_SOURCE_CHOICES = [
    ("CAD_BOM", "CAD_BOM"),
    ("MANUAL", "MANUAL"),
]


class Quote(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    quoteNumber = models.CharField(max_length=120, blank=True, default="")
    status = models.CharField(max_length=50, default="DRAFT")
    clientRef = models.JSONField(null=True, blank=True)
    linkedDesign = models.JSONField(null=True, blank=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    shipping = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    freight = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount = models.JSONField(default=dict, blank=True)
    discountAmount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    taxRate = models.DecimalField(max_digits=8, decimal_places=4, default=0.16)
    taxAmount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    audit = models.JSONField(default=dict, blank=True)
    extras = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.id


class QuoteLineItem(models.Model):
    id = models.CharField(primary_key=True, max_length=120)
    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name="lineItems")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    source = models.CharField(max_length=20, choices=QUOTE_LINE_SOURCE_CHOICES, default="MANUAL")
    traceability = models.JSONField(null=True, blank=True)
    catalogRef = models.JSONField(null=True, blank=True)
    cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    marginRate = models.DecimalField(max_digits=8, decimal_places=4, default=0.2)
    price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    quantity = models.DecimalField(max_digits=14, decimal_places=2, default=1)
    discount = models.JSONField(default=dict, blank=True)
    discountAmount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    isReadOnlyFromCad = models.BooleanField(default=False)
    isDesignLinked = models.BooleanField(default=False)
    audit = models.JSONField(default=dict, blank=True)
    extras = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.id
