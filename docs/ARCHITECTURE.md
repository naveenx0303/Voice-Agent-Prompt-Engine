# Architecture

## Pipeline

The engine is a three-stage pipeline. Each stage is a separate module with no shared state, which keeps every piece independently testable.

```
        ┌────────────────┐     ┌─────────────────┐     ┌──────────────┐
config ─▶  validate.js   │────▶│    index.js      │────▶│   output     │
 JSON   │  Ajv schema    │     │  Liquid render   │     │  tidy() +    │
        │  + semantic    │     │  main → partials │     │  stats       │
        │  cross-checks  │     │  + filters       │     │              │
        └────────────────┘     └─────────────────┘     └──────────────┘
```

### Stage 1 — Validation (`src/validate.js`)

Two layers, run in order:

**Structural (Ajv + JSON Schema draft-07).** Shape, enums, patterns, required fields. The `action` object uses `oneOf` discriminated on `type`, so each action variant gets its own required-field contract.

**Semantic.** Rules a schema cannot express because they cross object boundaries:

| Check | Why it matters in production |
| --- | --- |
| Transfer `contactId` exists in routing table | A dangling transfer strands a live caller |
| Fallback chain entries exist | The chain is the last line of defense; it must be sound |
| Scenario IDs unique | IDs appear in compiled output and logs |
| Scenario priorities unique | Ties make intent matching nondeterministic |
| `open < close` per interval | Inverted hours silently mark a business closed |

Validation failures abort compilation with all errors at once (Ajv `allErrors: true`), not fail-fast — config authors fix everything in one pass.

### Stage 2 — Template composition (`templates/`)

`main.liquid` does nothing except order partials. Ordering is a deliberate prompt-engineering choice:

1. `identity` — persona grounding comes first
2. `hours` — temporal context the agent needs before promising anything
3. `routing` — the transfer directory and protocol
4. `scenarios` — the playbook, sorted by priority at render time (`| sort: "priority"`), so config file order never matters
5. `guardrails` — last, because the most recent instruction tends to win on conflict

The `action.liquid` partial is a single dispatcher (`{% case action.type %}`) rendered inside every scenario. Adding a sixth action type means one new `when` branch and one schema variant — no scenario template changes.

### Stage 3 — Custom filters (`src/filters.js`)

Templates never compute; they only select and format via filters:

- `format_intervals` — interval arrays → "8:00 AM–12:00 PM, 1:00 PM–6:00 PM" or "Closed"
- `format_phone` — digit normalization for spoken-friendly numbers
- `voice_style_guide` / `after_hours_guide` — enum keys → full behavioral instructions (single source of truth: change the wording once, every compiled prompt updates)
- `followup_contact_field` — channel → which contact detail to confirm

Filters are pure functions, exported individually, and unit-tested without touching Liquid.

## Prompt-engineering notes baked into the templates

- **XML-style section tags** (`<scenario_playbook>`, `<guardrails>`) give the model unambiguous section boundaries and let downstream tooling parse compiled prompts.
- **Explicit tie-breaking language** ("first listed wins") pairs with the priority sort so the model and the validator agree on semantics.
- **Negative audience routing** (`Does NOT apply to… choose the next matching scenario`) handles the classic new-vs-existing-patient overlap without a special-case template.
- **ID hygiene**: machine identifiers are rendered for tooling but the guardrails section forbids reading them aloud — and a test asserts that instruction is present.
- **`tidy()`** collapses 3+ newlines post-render; tokens are money on every call.

## Failure modes considered

| Failure | Mitigation |
| --- | --- |
| Config edited by non-engineer breaks prompt | Validation gate before any render; `--validate-only` for CI |
| Template typo references missing filter | `strictFilters: true` fails the build loudly |
| Optional field absent | `strictVariables: false` + `{% if %}` guards render nothing rather than "undefined" |
| Prompt bloat as scenarios grow | Stats output (`approxTokens`) on every compile; budget enforcement is on the roadmap |
