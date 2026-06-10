#!/usr/bin/env node
/**
 * cli.js — compile a business config into a voice-agent system prompt.
 *
 * Usage:
 *   node src/cli.js --config examples/dental-clinic.json
 *   node src/cli.js --config examples/dental-clinic.json --out dist/prompt.txt
 *   node src/cli.js --config examples/dental-clinic.json --validate-only
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { compilePrompt } from "./index.js";
import { validateConfig } from "./validate.js";

const { values } = parseArgs({
  options: {
    config: { type: "string" },
    out: { type: "string" },
    "validate-only": { type: "boolean", default: false },
  },
});

if (!values.config) {
  console.error("Usage: vape --config <path.json> [--out <path.txt>] [--validate-only]");
  process.exit(2);
}

const config = JSON.parse(readFileSync(values.config, "utf8"));

if (values["validate-only"]) {
  const { valid, errors } = validateConfig(config);
  if (valid) {
    console.log(`✔ ${values.config} is valid`);
    process.exit(0);
  }
  console.error(`✘ ${values.config} failed validation:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

try {
  const { prompt, stats } = await compilePrompt(config);
  if (values.out) {
    mkdirSync(path.dirname(values.out), { recursive: true });
    writeFileSync(values.out, prompt, "utf8");
    console.log(`✔ wrote ${values.out}`);
  } else {
    console.log(prompt);
  }
  console.error(
    `— ${stats.characters} chars (~${stats.approxTokens} tokens), ` +
      `${stats.scenarioCount} scenarios, ${stats.contactCount} contacts`
  );
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
