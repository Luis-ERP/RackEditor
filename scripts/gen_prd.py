"""Generate prd.json from docs/frontend_app_checklist.md"""
import json, re, pathlib

ROOT = pathlib.Path(__file__).parent.parent
src  = ROOT / "docs" / "frontend_app_checklist.md"
out  = ROOT / "prd.json"

items    = []
section  = ""
subsect  = ""
counters = {}

for line in src.read_text().splitlines():
    h2 = re.match(r'^## \d+\) (.+)', line)
    h3 = re.match(r'^### \d+\.\d+ (.+)', line)
    if h2:
        section = h2.group(1).strip()
        subsect = ""
        continue
    if h3:
        subsect = h3.group(1).strip()
        continue

    m = re.match(r'^- \[ \] \*\*(Must|Should|Could)\*\* (.+)', line)
    if not m:
        continue

    priority    = m.group(1).lower()
    description = m.group(2).strip()

    label  = (subsect or section or "general")
    prefix = re.sub(r'[^A-Z]', '', label.upper())[:6] or "GEN"
    counters[prefix] = counters.get(prefix, 0) + 1
    item_id = f"{prefix}-{counters[prefix]:03d}"

    items.append({
        "id":          item_id,
        "category":    re.sub(r'[^a-z0-9]+', '-', (subsect or section).lower()).strip('-'),
        "section":     section,
        "subsection":  subsect,
        "priority":    priority,
        "description": description,
        "steps": [
            f"Verify: {description}",
            "Confirm it matches specs/frontend-checklist.md",
            "Run feedback loops: cd apps/web && npm run lint && npm run build",
        ],
        "passes": False,
    })

out.write_text(json.dumps(items, indent=2))
print(f"Wrote {len(items)} PRD items to {out}")
