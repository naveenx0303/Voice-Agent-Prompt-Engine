/**
 * validate.js — two-layer validation:
 *   1. Structural: JSON Schema via Ajv.
 *   2. Semantic: cross-reference checks the schema can't express
 *      (e.g., scenario transfer targets must exist in the routing table).
 */
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "..", "schema", "config.schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);
const structural = ajv.compile(schema);

/**
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateConfig(config) {
  const errors = [];

  if (!structural(config)) {
    for (const e of structural.errors ?? []) {
      errors.push(`schema: ${e.instancePath || "/"} ${e.message}`);
    }
    return { valid: false, errors };
  }

  const contactIds = new Set(config.routing.contacts.map((c) => c.id));

  // Every transfer action must point at a real contact.
  for (const s of config.scenarios) {
    if (s.action.type === "transfer" && !contactIds.has(s.action.contactId)) {
      errors.push(
        `semantic: scenario "${s.id}" transfers to unknown contactId "${s.action.contactId}"`
      );
    }
  }

  // Fallback chain entries must be real contacts.
  for (const id of config.routing.fallbackChain) {
    if (!contactIds.has(id)) {
      errors.push(`semantic: fallbackChain references unknown contactId "${id}"`);
    }
  }

  // Scenario ids and priorities must be unique (priority ties make matching ambiguous).
  const seenIds = new Set();
  const seenPriorities = new Map();
  for (const s of config.scenarios) {
    if (seenIds.has(s.id)) errors.push(`semantic: duplicate scenario id "${s.id}"`);
    seenIds.add(s.id);
    if (seenPriorities.has(s.priority)) {
      errors.push(
        `semantic: scenarios "${seenPriorities.get(s.priority)}" and "${s.id}" share priority ${s.priority}`
      );
    }
    seenPriorities.set(s.priority, s.id);
  }

  // Hours sanity: open must precede close within each interval.
  const allDays = { ...config.hours.weekly };
  for (const [day, intervals] of Object.entries(allDays)) {
    for (const i of intervals) {
      if (i.open >= i.close) {
        errors.push(`semantic: ${day} interval ${i.open}–${i.close} has open >= close`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
