/**
 * index.js — the prompt engine.
 * compilePrompt(config) -> { prompt, stats } or throws on invalid config.
 */
import { Liquid } from "liquidjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerFilters } from "./filters.js";
import { validateConfig } from "./validate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createEngine() {
  const engine = new Liquid({
    root: path.join(__dirname, "..", "templates"),
    partials: path.join(__dirname, "..", "templates", "partials"),
    extname: ".liquid",
    strictVariables: false, // optional fields may be absent
    strictFilters: true, // typo'd filter names should fail loudly
    trimTagRight: false,
    greedy: true, // {%- -%} trims across newlines for tight output
  });
  registerFilters(engine);
  return engine;
}

/** Collapse runs of 3+ blank lines so prompts stay tight. */
function tidy(text) {
  return text.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/**
 * @param {object} config - validated business configuration
 * @param {{ skipValidation?: boolean }} [opts]
 */
export async function compilePrompt(config, opts = {}) {
  if (!opts.skipValidation) {
    const { valid, errors } = validateConfig(config);
    if (!valid) {
      const err = new Error(`Invalid config:\n  - ${errors.join("\n  - ")}`);
      err.validationErrors = errors;
      throw err;
    }
  }

  const engine = createEngine();
  const raw = await engine.renderFile("main", config);
  const prompt = tidy(raw);

  return {
    prompt,
    stats: {
      characters: prompt.length,
      approxTokens: Math.ceil(prompt.length / 4),
      scenarioCount: config.scenarios.length,
      contactCount: config.routing.contacts.length,
    },
  };
}
