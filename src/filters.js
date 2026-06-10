/**
 * filters.js — custom Liquid filters registered on the engine.
 * These keep templates declarative: formatting/logic lives here, not in Liquid.
 */

const DAY_NAMES = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday",
  thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

const VOICE_STYLES = {
  "warm-professional": "warm, professional, and reassuring",
  "concise-efficient": "brisk, clear, and efficient — short sentences, no filler",
  "friendly-casual": "friendly and conversational, like a helpful neighbor",
  "formal": "formal and courteous",
};

const AFTER_HOURS = {
  voicemail_summary:
    "take a voicemail-style message (name, number, reason), confirm it back, and promise a callback on the next business day",
  emergency_triage:
    "determine whether this is an emergency; if yes, follow the matching escalation scenario; if no, take a message for the next business day",
  schedule_callback:
    "offer to book a callback slot during the next open hours instead of taking a free-form message",
  answer_faq_only:
    "answer general questions from the knowledge base only — take no actions and make no commitments until the business reopens",
};

/** "09:00" -> "9:00 AM" */
export function to12h(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Render an array of {open, close} intervals, or "Closed". */
export function formatIntervals(intervals) {
  if (!Array.isArray(intervals) || intervals.length === 0) return "Closed";
  return intervals.map((i) => `${to12h(i.open)}–${to12h(i.close)}`).join(", ");
}

/** Loose US-style phone prettifier; passes through anything it can't parse. */
export function formatPhone(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return String(raw);
}

/** Which contact field to confirm for a follow-up channel. */
export function followupContactField(channel) {
  if (channel === "sms") return "mobile number";
  if (channel === "email") return "email address";
  return "mobile number and email address";
}

/** Register all custom filters on a Liquid engine instance. */
export function registerFilters(engine) {
  engine.registerFilter("day_name", (abbr) => DAY_NAMES[abbr] ?? abbr);
  engine.registerFilter("format_intervals", formatIntervals);
  engine.registerFilter("format_phone", formatPhone);
  engine.registerFilter(
    "voice_style_guide",
    (key) => VOICE_STYLES[key] ?? key
  );
  engine.registerFilter(
    "after_hours_guide",
    (key) => AFTER_HOURS[key] ?? key
  );
  engine.registerFilter("followup_contact_field", followupContactField);
}
