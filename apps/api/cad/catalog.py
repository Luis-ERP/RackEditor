import csv
import functools
import os

from django.conf import settings


def _catalog_path(filename):
    return os.path.join(settings.BASE_DIR, "static", "catalog", filename)


@functools.lru_cache(maxsize=1)
def _load_catalog():
    """Load frames.csv and beams.csv into a SKU-keyed dict. Cached for the process lifetime."""
    catalog = {}
    sources = [
        ("frames.csv", "cost"),
        ("beams.csv", "price"),
    ]
    for filename, cost_col in sources:
        with open(_catalog_path(filename), newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                sku = row["sku"].strip()
                catalog[sku] = {
                    "sku": sku,
                    "cost": float(row[cost_col]),
                    "category": row.get("category", ""),
                    "type": row.get("type", ""),
                }
    return catalog


def lookup_sku(sku: str) -> dict | None:
    """Return the catalog entry for a SKU, or None if not found."""
    return _load_catalog().get(sku)


def reload_catalog():
    """Clear the in-process cache. Useful in tests."""
    _load_catalog.cache_clear()
