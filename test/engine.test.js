import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compilePrompt } from "../src/index.js";
import { validateConfig } from "../src/validate.js";
import { formatIntervals, formatPhone, to12h } from "../src/filters.js";

const dental = JSON.parse(readFileSync("examples/dental-clinic.json", "utf8"));
const hvac = JSON.parse(readFileSync("examples/hvac-company.json", "utf8"));

// ---------- filters ----------
test("to12h converts 24h time", () => {
  assert.equal(to12h("08:00"), "8:00 AM");
  assert.equal(to12h("13:05"), "1:05 PM");
  assert.equal(to12h("00:30"), "12:30 AM");
  assert.equal(to12h("12:00"), "12:00 PM");
});

test("formatIntervals handles closed days and split shifts", () => {
  assert.equal(formatIntervals([]), "Closed");
  assert.equal(formatIntervals(undefined), "Closed");
  assert.equal(
    formatIntervals([
      { open: "08:00", close: "12:00" },
      { open: "13:00", close: "18:00" },
    ]),
    "8:00 AM–12:00 PM, 1:00 PM–6:00 PM"
  );
});

test("formatPhone prettifies 10/11-digit numbers, passes through others", () => {
  assert.equal(formatPhone("5550104477"), "(555) 010-4477");
  assert.equal(formatPhone("15550107733"), "+1 (555) 010-7733");
  assert.equal(formatPhone("112"), "112");
});

// ---------- validation ----------
test("example configs validate cleanly", () => {
  assert.deepEqual(validateConfig(dental).errors, []);
  assert.deepEqual(validateConfig(hvac).errors, []);
});

test("rejects transfer to unknown contact", () => {
  const bad = structuredClone(dental);
  bad.scenarios[3].action.contactId = "ghost_contact";
  const { valid, errors } = validateConfig(bad);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("ghost_contact")));
});

test("rejects duplicate scenario priorities", () => {
  const bad = structuredClone(dental);
  bad.scenarios[1].priority = bad.scenarios[0].priority;
  const { valid, errors } = validateConfig(bad);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("share priority")));
});

test("rejects inverted hours interval", () => {
  const bad = structuredClone(dental);
  bad.hours.weekly.mon = [{ open: "17:00", close: "08:00" }];
  const { valid } = validateConfig(bad);
  assert.equal(valid, false);
});

// ---------- compilation ----------
test("compiles dental config with all sections in order", async () => {
  const { prompt, stats } = await compilePrompt(dental);
  const order = [
    "<identity>",
    "<business_hours",
    "<contact_routing>",
    "<scenario_playbook>",
    "<guardrails>",
  ];
  let last = -1;
  for (const tag of order) {
    const idx = prompt.indexOf(tag);
    assert.ok(idx > last, `${tag} missing or out of order`);
    last = idx;
  }
  assert.equal(stats.scenarioCount, 5);
});

test("scenarios render in priority order regardless of config order", async () => {
  const shuffled = structuredClone(dental);
  shuffled.scenarios.reverse();
  const { prompt } = await compilePrompt(shuffled);
  const emergency = prompt.indexOf('id="dental_emergency"');
  const billing = prompt.indexOf('id="billing_question"');
  assert.ok(emergency !== -1 && billing !== -1);
  assert.ok(emergency < billing, "priority 1 must render before priority 20");
});

test("transfer action resolves contact label from routing table", async () => {
  const { prompt } = await compilePrompt(dental);
  assert.ok(prompt.includes("TRANSFER to Billing Team"));
});

test("internal IDs are guarded, not leaked into spoken instructions", async () => {
  const { prompt } = await compilePrompt(dental);
  assert.ok(prompt.includes("Never read internal IDs"));
});

test("compilePrompt throws on invalid config", async () => {
  const bad = structuredClone(hvac);
  bad.routing.fallbackChain.push("nobody_home");
  await assert.rejects(() => compilePrompt(bad), /nobody_home/);
});
