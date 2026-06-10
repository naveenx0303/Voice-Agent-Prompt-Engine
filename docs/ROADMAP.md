# Build Roadmap — Creation to Completion

This documents how the project was (and should be) built, in commit-sized steps. Use it as your actual commit plan so the GitHub history tells a story reviewers can follow.

## Phase 0 — Repository setup

```bash
git init voice-agent-prompt-engine && cd voice-agent-prompt-engine
git branch -M main
```

- Repo name: `voice-agent-prompt-engine`
- Description: "Config-driven prompt compiler for AI voice agents — LiquidJS templates, JSON Schema validation, priority-based scenario routing."
- Topics: `prompt-engineering`, `liquidjs`, `ai-agents`, `voice-ai`, `nodejs`, `json-schema`
- License: MIT. Visibility: public.

## Phase 1 — Contract first (commits 1–2)

> **Commit 1:** `chore: scaffold project (package.json, gitignore, license)`
> **Commit 2:** `feat: define business config contract as JSON Schema`

Start from the schema, not the templates. The schema *is* the product decision: what can a business configure? Write `schema/config.schema.json` and one example config (`examples/dental-clinic.json`) together — the example keeps the schema honest.

Decisions to make here:
- Action types as a `oneOf` discriminated union on `action.type`
- Integer `priority` per scenario instead of type-buckets
- Hours as `weekday -> interval[]` (empty array = closed; arrays support split shifts)

## Phase 2 — Validation (commit 3)

> **Commit 3:** `feat: two-layer config validation (Ajv structural + semantic cross-checks)`

Build `src/validate.js` with the semantic checks listed in ARCHITECTURE.md. Write the validation tests *in this commit* — they're the cheapest tests in the repo and they document intent.

## Phase 3 — Template system (commits 4–6)

> **Commit 4:** `feat: liquid engine setup with custom filters`
> **Commit 5:** `feat: identity, hours, and routing partials`
> **Commit 6:** `feat: scenario playbook with priority sort + action dispatcher partial`

Order of work inside this phase: filters first (pure functions, test as you go), then static partials (identity/hours/routing), then the dynamic ones (scenarios/action). Keep one rule: if a template needs logic beyond if/for/case, it becomes a filter.

## Phase 4 — Engine + CLI (commits 7–8)

> **Commit 7:** `feat: compilePrompt() pipeline with output tidying and stats`
> **Commit 8:** `feat: CLI with --out and --validate-only modes`

`compilePrompt` = validate → render → tidy → stats. The CLI is thin: parse args, read file, call the library, print. Exit codes matter (0 ok, 1 validation/compile failure, 2 usage) — they make the tool CI-friendly.

## Phase 5 — Second example + integration tests (commits 9–10)

> **Commit 9:** `feat: HVAC example config (24/7 emergency tier, after-hours callback)`
> **Commit 10:** `test: compilation ordering, contact resolution, ID-leak guard`

The second example exists to prove the engine generalizes across industries — different after-hours policy, different action mix. Integration tests assert section order, priority ordering survives a shuffled config, transfer labels resolve, and the ID-hygiene guardrail renders.

## Phase 6 — CI + docs (commits 11–12)

> **Commit 11:** `ci: github actions — test + validate all example configs on push`
> **Commit 12:** `docs: README, architecture notes, roadmap`

CI runs `npm test` plus `--validate-only` over every file in `examples/` so a broken example can never merge.

## Phase 7 — Polish for portfolio review

- Pin a short demo: paste the dental example's compiled output into the README or a GIF of the CLI run.
- Add 2–3 GitHub Issues yourself for roadmap items (snapshot tests, token budgets, web playground). Open issues signal you think beyond v1.
- Optional release: tag `v1.0.0` with release notes summarizing the design decisions.

## Talking points for interviews

1. **Why compile prompts?** Reproducibility, diff-ability, hundreds of tenants from one codebase.
2. **Why priorities over type buckets?** Deterministic resolution of overlapping intents; the validator enforces it.
3. **Why semantic validation?** JSON Schema can't see across objects; a dangling `contactId` is a stranded caller, not a 500 error.
4. **Why filters over template logic?** Unit-testability and a single source of truth for behavioral wording.
5. **Why section ordering?** Recency effects: guardrails last.
