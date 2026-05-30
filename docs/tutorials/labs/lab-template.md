# Lab Template

Use this template when authoring new tutorial labs.

---

## Lab N — [Short Lab Title]

**Audience:** [New users / Returning users / Advanced]
**Estimated time:** [X minutes]
**Prerequisites:** [Lab N-1, or "none"]
**Completion artifact:** [saved project / valid BOM / quote revision / export package]

---

### Scenario

Describe the realistic customer or design situation the user is solving. Ground the lab in a business outcome, not in UI steps. Example: "A customer needs a 10-bay selective rack line in a single aisle. You will configure the layout, validate it, and hand it off to Quoter."

---

### Starter state

Describe what already exists before the lab begins:

- **Project**: [blank canvas / pre-seeded project file attached below]
- **Quoter**: [empty / partially filled quote]
- **Any other relevant state**

If a starter project file is used, reference it here and describe how to load it.

---

### Steps

Each step block follows the same format:

---

#### Step N.1 — [Action Title]

**Action:** One sentence describing exactly what the user must do.

**Expected result:** What the user should see after completing the action.

> **Business logic:** Why the app behaves that way. Reference the relevant internal doc if applicable.

---

#### Step N.2 — [Action Title]

**Action:** …

**Expected result:** …

> **Business logic:** …

---

*(Add as many steps as needed. Keep labs to 3–6 steps. More than 6 steps indicates the lab should be split.)*

---

### Checkpoint

One self-check question the user answers before marking the lab complete.

**Question:** [e.g., "Does the validation panel show VALID status for your rack line?"]

**Pass condition:** [e.g., The rack line status badge is green and reads VALID.]

---

### Completion artifact

Describe the concrete output the user has produced:

- [ ] [e.g., A saved project with one rack line in VALID state]
- [ ] [e.g., A BOM snapshot visible in the Quoter]
- [ ] [e.g., A downloaded quote PDF]

---

### Sidebars

Include exactly two sidebar callouts per lab:

> **User takeaway:** What the operator needs to remember for daily use.

> **Internal logic:** What rule or derivation the system applied. Link to the relevant internal doc for a full explanation.

---

### Authoring notes

*(Remove this section before publishing.)*

- Keep scenarios grounded in a single domain problem.
- Checkpoints should be self-checking: the user can verify pass/fail without assistance.
- Limit hints to one sentence. Long hints train users to skip reading.
- Every step must produce a visible result the user can confirm.
- Spotlight targets should use `data-tutorial="…"` attributes, not class or tag selectors.
- If a step requires switching pages (CAD → Quoter), note it explicitly in the action.
