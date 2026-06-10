# Voice Agent Prompt Engine

A config-driven **prompt compilation engine** for AI voice agents. It turns structured business configuration — call-handling scenarios, business hours, contact routing, and action definitions — into production-ready system prompts using [LiquidJS](https://liquidjs.com/) template composition.

This is a sanitized portfolio rebuild of a production system I built for an AI phone-answering product. All business data, IDs, and integrations here are fictional; the architecture and engineering patterns are real.

```
business config (JSON) ──▶ validate ──▶ compose templates ──▶ system prompt (text)
                           Ajv +        LiquidJS partials +
                           semantic     custom filters
                           checks
```

## Why this exists

Voice agents serve hundreds of different businesses from one codebase. Hand-writing a system prompt per customer doesn't scale and drifts out of sync with their settings. This engine treats the prompt as a **build artifact**: business owners edit structured config, and the engine deterministically compiles it into a prompt with consistent structure, ordering, and guardrails.

## Key design decisions

1. **Prompt-as-compilation, not prompt-as-document.** Config in, prompt out, fully reproducible. Prompts can be diffed, snapshot-tested, and regenerated on every config change.
2. **Priority-ordered scenario matching.** Scenarios carry an explicit integer priority instead of being bucketed by type. Overlapping intents (e.g. "emergency" vs "book appointment") resolve deterministically, and the validator rejects priority ties.
3. **Two-layer validation.** JSON Schema (Ajv) catches structural errors; a semantic layer catches what schemas can't — transfers pointing at nonexistent contacts, broken fallback chains, inverted hour intervals, duplicate priorities.
4. **Logic in filters, not templates.** Templates stay declarative. Time formatting, phone formatting, voice-style expansion, and after-hours policy text live in registered Liquid filters (`src/filters.js`), which are unit-testable in isolation.
5. **Section ordering is intentional.** Identity first (who the agent is), guardrails last (most recent instruction in context wins on conflict).
6. **Internal IDs never leak.** Contact and calendar IDs exist for machine actions; the compiled prompt explicitly instructs the agent never to read them aloud, and a test enforces this.

## Quick start

```bash
npm install
npm run build                # compile the dental clinic example to stdout
npm run build:hvac           # second example: HVAC company with 24/7 emergency tier
npm run validate             # validate a config without compiling
npm test                     # 12 unit + integration tests
npm run snapshot             # write compiled prompt to dist/
```

## Configuration model

| Section     | What it controls                                                                |
| ----------- | ------------------------------------------------------------------------------- |
| `business`  | Name, industry, timezone, locations                                              |
| `agent`     | Persona name, voice style, languages, max call length                            |
| `hours`     | Weekly schedule (split shifts supported), holiday overrides, after-hours policy  |
| `routing`   | Transfer directory grouped by department, warm/cold style, ordered fallback chain|
| `scenarios` | Priority-ordered intent handlers, each bound to exactly one action               |
| `guardrails`| Prohibited topics, compliance notes, hard "never do" rules                       |

### Action types

Every scenario ends in one of five actions:

- `capture_lead` — conversational field collection with per-field prompts, required flags, and validation hints
- `schedule_appointment` — calendar booking with slot length and buffer rules
- `transfer` — routed through the contact directory; label resolved at compile time
- `send_followup` — SMS/email resource delivery with contact confirmation
- `escalate` — urgent/emergency handling with explicit operator instructions

See `schema/config.schema.json` for the full contract and `examples/` for two complete configs.

## Project layout

```
├── schema/config.schema.json    # the config contract (JSON Schema draft-07)
├── src/
│   ├── index.js                 # compilePrompt(): validate → render → tidy
│   ├── validate.js              # structural (Ajv) + semantic validation
│   ├── filters.js               # custom Liquid filters (pure, unit-tested)
│   └── cli.js                   # vape --config <file> [--out] [--validate-only]
├── templates/
│   ├── main.liquid              # section composition + ordering
│   └── partials/                # identity, hours, routing, scenarios, action, guardrails
├── examples/                    # dental clinic, HVAC company
├── test/engine.test.js          # filters, validation, compilation, ordering
└── docs/                        # architecture notes + build roadmap
```

## What I'd add next

- Snapshot testing of compiled prompts in CI (golden files per example config)
- Token budget enforcement with per-section trimming strategies
- A/B prompt variants compiled from the same config
- Web playground (config editor → live compiled prompt preview)

## License

MIT
