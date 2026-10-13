const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = require("../app.js");

const source = fs.readFileSync(path.join(__dirname, "..", "class-ThreesidesTrackingSignals.php"), "utf8");
const signals = [...source.matchAll(/array\('input' => (\d+), 'key' => '([a-z0-9_]+)'/g)].map((m) => ({
  input: Number(m[1]),
  key: m[2],
}));

test("the PHP registry parses", () => {
  assert.equal(signals.length, 21);
});

test("PHP registry keys match app.js SIGNAL_KEYS in order", () => {
  assert.deepEqual(
    signals.map((s) => s.key),
    app.SIGNAL_KEYS
  );
});

test("input suffixes are unique, ascending and never end in 0", () => {
  const inputs = signals.map((s) => s.input);
  assert.equal(new Set(inputs).size, inputs.length);
  inputs.forEach((input, i) => {
    assert.notEqual(input % 10, 0, "suffix " + input + " ends in 0");
    if (i > 0) assert.ok(input > inputs[i - 1], "suffix " + input + " out of order");
  });
});

test("released suffixes are pinned", () => {
  // Changing any of these breaks stored entries and feed mappings. Only append.
  assert.deepEqual(
    Object.fromEntries(signals.map((s) => [s.key, s.input])),
    {
      ga_client_id: 1, ga_session_id: 2, gclid: 3, gbraid: 4, wbraid: 5, gad_source: 6,
      gad_campaignid: 7, fbc: 8, fbp: 9, msclkid: 11, li_fat_id: 12, ttclid: 13, utm_source: 14,
      utm_medium: 15, utm_campaign: 16, utm_term: 17, utm_content: 18, utm_id: 19,
      landing_page: 21, referrer: 22, touch_time: 23,
    }
  );
});
