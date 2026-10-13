const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app.js");

const T1 = Date.UTC(2026, 9, 1, 0, 0, 0);
const T2 = Date.UTC(2026, 9, 5, 0, 0, 0);
const SITE = "https://www.example.com";

test("a gclid landing stores the click and a full touch", () => {
  const url = SITE + "/?gclid=Cj0abc&utm_source=google&utm_medium=cpc";
  const state = app.updateState(app.emptyState(), url, "https://www.google.com/", T1);

  assert.deepEqual(state.clicks.gclid, { value: "Cj0abc", ts: T1 });
  assert.equal(state.touch.utm_source, "google");
  assert.equal(state.touch.utm_medium, "cpc");
  assert.equal(state.touch.utm_campaign, "");
  assert.equal(state.touch.landing_page, url);
  assert.equal(state.touch.referrer, "https://www.google.com/");
  assert.equal(state.touch.touch_time, "2026-10-01T00:00:00.000Z");
});

test("click IDs keep their case exactly", () => {
  const state = app.updateState(app.emptyState(), SITE + "/?fbclid=IwAR0AbCdEf", "", T1);
  assert.equal(state.clicks.fbclid.value, "IwAR0AbCdEf");
});

test("the same click ID seen again keeps its original timestamp", () => {
  const first = app.updateState(app.emptyState(), SITE + "/?fbclid=AAA", "", T1);
  const second = app.updateState(first, SITE + "/?fbclid=AAA", "", T2);
  assert.equal(second.clicks.fbclid.ts, T1);
});

test("a new click ID replaces only its own platform", () => {
  const first = app.updateState(app.emptyState(), SITE + "/?gclid=G1", "", T1);
  const second = app.updateState(first, SITE + "/?fbclid=F1&utm_source=facebook", "", T2);

  assert.deepEqual(second.clicks.gclid, { value: "G1", ts: T1 });
  assert.deepEqual(second.clicks.fbclid, { value: "F1", ts: T2 });
  assert.equal(second.touch.utm_source, "facebook");
});

test("a new touch replaces the old one wholesale rather than merging", () => {
  const first = app.updateState(app.emptyState(), SITE + "/?utm_source=google&utm_campaign=brand", "", T1);
  const second = app.updateState(first, SITE + "/?utm_source=newsletter", "", T2);
  assert.equal(second.touch.utm_source, "newsletter");
  assert.equal(second.touch.utm_campaign, "");
});

test("direct and internal visits leave the touch unchanged", () => {
  const first = app.updateState(app.emptyState(), SITE + "/?utm_source=google", "", T1);
  const direct = app.updateState(first, SITE + "/about", "", T2);
  const internal = app.updateState(first, SITE + "/about", SITE + "/", T2);
  assert.deepEqual(direct.touch, first.touch);
  assert.deepEqual(internal.touch, first.touch);
});

test("an external referrer with no parameters starts a new touch", () => {
  const first = app.updateState(app.emptyState(), SITE + "/?utm_source=google", "", T1);
  const organic = app.updateState(first, SITE + "/blog", "https://duckduckgo.com/", T2);
  assert.equal(organic.touch.utm_source, "");
  assert.equal(organic.touch.referrer, "https://duckduckgo.com/");
});

test("gad_source alone starts a touch", () => {
  const state = app.updateState(app.emptyState(), SITE + "/?gad_source=1&gad_campaignid=999", "", T1);
  assert.equal(state.touch.gad_source, "1");
  assert.equal(state.touch.gad_campaignid, "999");
});

test("empty parameters are ignored", () => {
  const state = app.updateState(app.emptyState(), SITE + "/?gclid=&utm_source=", "", T1);
  assert.deepEqual(state.clicks, {});
  assert.equal(state.touch, null);
});

test("updateState does not mutate its input", () => {
  const first = app.updateState(app.emptyState(), SITE + "/?gclid=G1", "", T1);
  const snapshot = JSON.stringify(first);
  app.updateState(first, SITE + "/?fbclid=F1", "", T2);
  assert.equal(JSON.stringify(first), snapshot);
});

test("values are truncated: URLs to 500, others to 255", () => {
  const long = "x".repeat(600);
  const state = app.updateState(app.emptyState(), SITE + "/?gclid=" + long + "&utm_source=" + long, "", T1);
  assert.equal(state.clicks.gclid.value.length, 255);
  assert.equal(state.touch.utm_source.length, 255);
  assert.equal(state.touch.landing_page.length, 500);
});

test("an unparseable URL is treated as a direct visit", () => {
  const state = app.updateState(app.emptyState(), "not a url", "", T1);
  assert.equal(app.hasData(state), false);
});

test("malformed percent-encoding in the query does not throw", () => {
  const state = app.updateState(app.emptyState(), SITE + "/?utm_source=%E0%A4%A&gclid=G1", "", T1);
  assert.equal(state.clicks.gclid.value, "G1");
  assert.equal(typeof state.touch.utm_source, "string");
});

test("migrateLegacy seeds clicks and UTMs in legacy order", () => {
  const state = app.migrateLegacy(
    { _tsm_gclid: "G1", _tsm_fbclid: "F1", _tsm_utm: "google|cpc|brand|ad1|shoes" },
    T1
  );
  assert.deepEqual(state.clicks.gclid, { value: "G1", ts: T1 });
  assert.deepEqual(state.clicks.fbclid, { value: "F1", ts: T1 });
  assert.equal(state.touch.utm_source, "google");
  assert.equal(state.touch.utm_medium, "cpc");
  assert.equal(state.touch.utm_campaign, "brand");
  assert.equal(state.touch.utm_content, "ad1");
  assert.equal(state.touch.utm_term, "shoes");
});

test("migrateLegacy undoes the old HTML escaping", () => {
  const state = app.migrateLegacy({ _tsm_utm: "a&amp;b|||" }, T1);
  assert.equal(state.touch.utm_source, "a&b");
});

test("migrateLegacy returns null when there is nothing to migrate", () => {
  assert.equal(app.migrateLegacy({ _ga: "GA1.1.1.2" }, T1), null);
});

test("state round-trips through encode/decode", () => {
  const state = app.updateState(app.emptyState(), SITE + "/?gclid=G1&utm_source=a%3Bb%3Dc", "", T1);
  assert.deepEqual(app.decodeState(app.encodeState(state)), state);
});

test("encoded state is safe to put in a cookie", () => {
  const state = app.updateState(app.emptyState(), SITE + "/?utm_source=a;b,c d", "", T1);
  assert.doesNotMatch(app.encodeState(state), /[;,\s]/);
});

test("decodeState rejects garbage and unknown versions", () => {
  assert.equal(app.decodeState(""), null);
  assert.equal(app.decodeState("%E0%A4%A"), null);
  assert.equal(app.decodeState(encodeURIComponent("{}")), null);
  assert.equal(app.decodeState(encodeURIComponent(JSON.stringify({ v: 2, clicks: {} }))), null);
});

test("fitState shrinks oversized URLs to stay under the cookie limit", () => {
  // Non-ASCII UTMs expand ~6x when encoded; long URLs push the total past the limit.
  const campaign = encodeURIComponent("é".repeat(255));
  const url = SITE + "/landing?gclid=" + "g".repeat(255) + "&utm_campaign=" + campaign;
  const referrer = "https://ref.example.org/" + "%22".repeat(160);
  const state = app.updateState(app.emptyState(), url, referrer, T1);
  state.clicks.fbclid = { value: "f".repeat(255), ts: T1 };
  assert.ok(app.encodeState(state).length > app.MAX_COOKIE_LENGTH, "fixture must start oversized");

  const encoded = app.fitState(state);
  assert.ok(encoded.length <= app.MAX_COOKIE_LENGTH, "length " + encoded.length);

  const decoded = app.decodeState(encoded);
  assert.equal(decoded.touch.referrer, "https://ref.example.org/");
  assert.equal(decoded.touch.utm_campaign, "é".repeat(255));
  assert.equal(decoded.clicks.gclid.value.length, 255);
});

test("fitState leaves normal-sized state untouched", () => {
  const state = app.updateState(app.emptyState(), SITE + "/?gclid=G1", "https://google.com/", T1);
  assert.equal(app.fitState(state), app.encodeState(state));
});
