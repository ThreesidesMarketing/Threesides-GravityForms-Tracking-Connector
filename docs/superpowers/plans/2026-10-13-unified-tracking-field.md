# Unified Tracking Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four single-purpose hidden tracking fields with one Gravity Forms "Tracking Signals" field that collects 21 signals as individually mappable sub-inputs, fed by a rewritten site-wide capture script.

**Architecture:** `app.js` runs on every front-end page. It stores click IDs (one entry per ad platform) and a last-non-direct "touch" (UTMs, landing page, referrer, time) in one JSON cookie, `_tsm_attr`. It then fills any input carrying `data-tsm-signal="<key>"`, plus the legacy fields. A PHP signal registry is the single list of signals and their permanent sub-input IDs. The new `GF_Field` subclass renders one hidden input per enabled signal, Name/Address style, and reuses core's show/hide toggle UI. The four old field types stay registered with no editor button.

**Tech Stack:** WordPress plugin (PHP 7.4+, Gravity Forms 2.9+ add-on framework), vanilla ES5 JavaScript with no build step, `node:test` (Node 18+) and plain PHP CLI scripts for tests. No dependencies.

**Spec:** `docs/superpowers/specs/2026-10-13-unified-tracking-field-design.md`

## Global Constraints

- Minimum Gravity Forms version is `2.9`. PHP must run on 7.4: no `match`, nullsafe `?->`, named arguments, `str_contains`, union types or constructor promotion.
- `app.js` is shipped as written. Use ES5 syntax only (`var`, `function`), with no modules or transpilation. `URL`, `URLSearchParams` and `Object.assign` are allowed.
- No runtime dependencies and no build step. `package.json` exists only for `npm test`.
- One text domain everywhere: `threesides-gf-tracking-connector`.
- Cookie: `_tsm_attr`, `max-age=7776000` (90 days), `path=/`, `SameSite=Lax`, `Secure` on HTTPS, root domain when the browser allows it. Written only when state changes.
- Truncation: `landing_page` and `referrer` to 500 characters, every other value to 255. The encoded cookie value is capped at 3,500 characters.
- Sub-input suffixes are permanent:
  - 1 ga_client_id, 2 ga_session_id, 3 gclid, 4 gbraid, 5 wbraid, 6 gad_source, 7 gad_campaignid
  - 8 fbc, 9 fbp, 11 msclkid, 12 li_fat_id, 13 ttclid
  - 14 utm_source, 15 utm_medium, 16 utm_campaign, 17 utm_term, 18 utm_content, 19 utm_id
  - 21 landing_page, 22 referrer, 23 touch_time
  - No suffix may end in 0.
- New field type is `threesides_tracking_field`, in editor group `threesides_gf_tracking_connector`. Legacy type strings are unchanged: `threesides_ga4_client_id_tracking_field`, `threesides_gclid_tracking_field`, `threesides_fbclid_tracking_field`, `threesides_utms_tracking_field`.
- Click IDs are stored exactly as received: no case change and no HTML escaping. Meta `fbc` is `fb.1.<first-seen ms>.<fbclid>`.
- There is no consent gating: collect always.
- Match the existing code style:
  - PHP: 4-space indent, braces on new lines for classes and methods, `array()` syntax, docblocks on public methods.
  - JS: 2-space indent, double quotes.
- End every commit message with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

These are failure modes the spec implies but doesn't state, most likely first. Each one is pinned by a test in the task that owns the code.

1. **Cookie access throws** (sandboxed iframes, some privacy modes). Expected: no exception, and the form still fills from the URL. Pinned in Task 3: "boot still fills from the URL when cookie access throws".
2. **Malformed percent-encoding in the landing URL** (`?utm_source=%E0%A4%A`). Expected: no exception, and the click ID is still recorded. Pinned in Task 2: "malformed percent-encoding in the query does not throw".
3. **An admin edits an entry and clicks Update.** Expected: the hidden signal values survive. Pinned in Task 5: "entry edit keeps values so updates do not wipe them".
4. **Two forms, or two Tracking fields, on one page.** Expected: every one is filled. Pinned in Task 3: "fillFields fills every matching input when a page has several forms".
5. **Gravity Forms' own AJAX submission reads the form before our capture-phase submit listener fills it.** Expected: values are saved. This is GF's JS and can't be unit-tested. Pinned by manual checklist §3, "Repeat with the form set to AJAX submission", in Task 8.

## File Map

| Path | Responsibility | Task |
|---|---|---|
| `package.json` | `npm test` runs every test suite | 1, 5, 6 |
| `app.js` | Capture, storage and filling (replaced in 1, extended in 2 and 3) | 1–3 |
| `tests/parsing.test.js` | Cookie and ID parsing | 1 |
| `tests/state.test.js` | Attribution state rules | 2 |
| `tests/fake-dom.js`, `tests/fill.test.js` | Signal resolution, filling, cookie writing, boot | 3 |
| `class-ThreesidesTrackingSignals.php` | Signal registry | 4 |
| `tests/registry.test.js` | PHP and JS key lists match; suffixes pinned | 4 |
| `class-ThreesidesTrackingField.php` | The Tracking Signals field | 5 |
| `tests/php/bootstrap.php`, `tests/php/field-test.php` | WP/GF stand-ins and field tests | 5 |
| `legacy/*.php`, `tests/php/legacy-test.php` | Old fields moved, buttons removed | 6 |
| `class-ThreesidesGravityFormsTrackingConnector.php` | Loading, site-wide script, wrapper class, editor setting, editor CSS | 6, 7 |
| `threesides-gf-tracking-connector.php`, `app.css` | Version 0.2.0; editor styles | 7 |
| `readme.md`, `docs/manual-testing.md` | User docs; in-WordPress checklist | 8 |

> **Between Task 1 and Task 3 the plugin captures nothing**, because `app.js` is mid-rewrite. Don't deploy the branch until Task 7 is committed.

---

### Task 1: Test tooling and cookie/ID parsing

**Files:**
- Create: `package.json`
- Replace: `app.js` (the whole file)
- Create: `tests/parsing.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - **Module shape:** `app.js` exports a module under Node (`typeof window === "undefined"`). In the browser it does nothing until Task 3.
  - **Constants:** `COOKIE_NAME` (`"_tsm_attr"`), `MAX_COOKIE_LENGTH` (`3500`), `SIGNAL_KEYS` (21 strings).
  - **Parsing functions:**
    - `parseCookies(string) → object` (first `=` splits; first duplicate wins)
    - `parseGaClientId(string) → string`
    - `parseGaSessionId(string) → string`
    - `findGaSessionCookie(cookies) → string`
    - `parseGclCookie(string) → string`
    - `truncate(value, max) → string`
    - `isExternalReferrer(referrer, currentUrl) → bool`
  - **Internal names later tasks rely on:** `CLICK_PARAMS`, `TOUCH_PARAMS`, `TOUCH_KEYS`, `LEGACY_SELECTORS`, `URL_MAX`, `VALUE_MAX`, `MAX_AGE`, `normaliseHost`, `hostOf`, `originOf`, `isSameSite`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "threesides-gf-tracking-connector",
  "private": true,
  "description": "Development tooling only: the plugin has no build step or runtime dependencies.",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/parsing.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app.js");

test("parseCookies splits on the first = only and trims whitespace", () => {
  const cookies = app.parseCookies(" _ga=GA1.1.123.456;  token=abc==; empty=; =nokey; novalue");
  assert.deepEqual(cookies, { _ga: "GA1.1.123.456", token: "abc==", empty: "" });
});

test("parseCookies keeps the first of duplicate names", () => {
  assert.equal(app.parseCookies("a=first; a=second").a, "first");
});

test("parseCookies handles prototype-like names", () => {
  assert.equal(app.parseCookies("constructor=x").constructor, "x");
});

test("parseCookies tolerates empty input", () => {
  assert.deepEqual(app.parseCookies(""), {});
  assert.deepEqual(app.parseCookies(undefined), {});
});

test("parseGaClientId keeps the last two segments regardless of domain depth", () => {
  assert.equal(app.parseGaClientId("GA1.1.123456789.1700000000"), "123456789.1700000000");
  assert.equal(app.parseGaClientId("GA1.2.123456789.1700000000"), "123456789.1700000000");
});

test("parseGaClientId returns empty for malformed or missing values", () => {
  assert.equal(app.parseGaClientId("GA1.1.123"), "");
  assert.equal(app.parseGaClientId(""), "");
  assert.equal(app.parseGaClientId(undefined), "");
});

test("parseGaSessionId reads GS1 and GS2 formats", () => {
  assert.equal(app.parseGaSessionId("GS1.1.1760000000.5.1.1760000500.0.0.0"), "1760000000");
  assert.equal(app.parseGaSessionId("GS2.1.s1760000000$o5$g1$t1760000500$j60$l0$h0"), "1760000000");
});

test("parseGaSessionId returns empty for unknown formats", () => {
  assert.equal(app.parseGaSessionId("GS3.1.x"), "");
  assert.equal(app.parseGaSessionId(""), "");
});

test("findGaSessionCookie finds the _ga_<ID> cookie but not _ga itself", () => {
  const cookies = { _ga: "GA1.1.1.2", _ga_ABC123XYZ: "GS2.1.s99$o1" };
  assert.equal(app.findGaSessionCookie(cookies), "GS2.1.s99$o1");
  assert.equal(app.findGaSessionCookie({ _ga: "GA1.1.1.2" }), "");
});

test("parseGclCookie strips the GCL.<timestamp>. prefix", () => {
  assert.equal(app.parseGclCookie("GCL.1760000000.Cj0KCQjw-abc_DEF"), "Cj0KCQjw-abc_DEF");
  assert.equal(app.parseGclCookie("GCL.1760000000"), "");
  assert.equal(app.parseGclCookie("XYZ.1.abc"), "");
  assert.equal(app.parseGclCookie(undefined), "");
});

test("truncate caps length and stringifies", () => {
  assert.equal(app.truncate("abcdef", 3), "abc");
  assert.equal(app.truncate("ab", 3), "ab");
  assert.equal(app.truncate(null, 3), "");
});

test("isExternalReferrer ignores same host, www and subdomains", () => {
  const page = "https://www.example.com.au/contact";
  assert.equal(app.isExternalReferrer("https://example.com.au/", page), false);
  assert.equal(app.isExternalReferrer("https://shop.example.com.au/cart", page), false);
  assert.equal(app.isExternalReferrer("https://www.google.com/", page), true);
  assert.equal(app.isExternalReferrer("", page), false);
  assert.equal(app.isExternalReferrer("not a url", page), false);
});

test("isExternalReferrer does not treat a lookalike suffix as the same site", () => {
  assert.equal(app.isExternalReferrer("https://notexample.com/", "https://example.com/"), true);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL. Requiring the old `app.js` under Node throws `ReferenceError: addEventListener is not defined`.

- [ ] **Step 4: Replace `app.js` with the parsing foundation**

Replace the entire contents of `app.js` with:

```js
/**
 * Threesides Gravity Forms Tracking Connector.
 *
 * Runs on every front-end page: captures ad click IDs, UTMs and landing context into a
 * first-party cookie, then fills Tracking Signals (and legacy) fields in Gravity Forms.
 */
(function (factory) {
  var api = factory();
  if (typeof window === "undefined") {
    module.exports = api;
  }
})(function () {
  "use strict";

  var COOKIE_NAME = "_tsm_attr";
  var MAX_AGE = 90 * 24 * 60 * 60;
  var MAX_COOKIE_LENGTH = 3500;
  var URL_MAX = 500;
  var VALUE_MAX = 255;

  var CLICK_PARAMS = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "li_fat_id", "ttclid"];
  var TOUCH_PARAMS = [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
    "gad_source", "gad_campaignid",
  ];
  var TOUCH_KEYS = TOUCH_PARAMS.concat(["landing_page", "referrer", "touch_time"]);

  // Must match ThreesidesTrackingSignals::all() — enforced by tests/registry.test.js.
  var SIGNAL_KEYS = [
    "ga_client_id", "ga_session_id", "gclid", "gbraid", "wbraid", "gad_source", "gad_campaignid",
    "fbc", "fbp", "msclkid", "li_fat_id", "ttclid", "utm_source", "utm_medium", "utm_campaign",
    "utm_term", "utm_content", "utm_id", "landing_page", "referrer", "touch_time",
  ];

  var LEGACY_SELECTORS = {
    ga4: ".ginput_container_threesides_ga4_client_id_tracking_field input[type=hidden]",
    gclid: ".ginput_container_threesides_gclid_tracking_field input[type=hidden]",
    fbclid: ".ginput_container_threesides_fbclid_tracking_field input[type=hidden]",
    utms: ".ginput_container_threesides_utms_tracking_field input[type=hidden]",
  };

  // # PARSING ------------------------------------------------------------------------------------

  function parseCookies(cookieString) {
    var cookies = {};
    String(cookieString || "").split(";").forEach(function (pair) {
      var index = pair.indexOf("=");
      if (index === -1) return;
      var key = pair.slice(0, index).trim();
      if (key && !Object.prototype.hasOwnProperty.call(cookies, key)) {
        cookies[key] = pair.slice(index + 1).trim();
      }
    });
    return cookies;
  }

  function parseGaClientId(value) {
    var parts = String(value || "").split(".");
    return parts.length >= 4 ? parts.slice(-2).join(".") : "";
  }

  function parseGaSessionId(value) {
    var text = String(value || "");
    var gs2 = /^GS2\.\d+\.s(\d+)/.exec(text);
    if (gs2) return gs2[1];
    var gs1 = /^GS1\.\d+\.(\d+)\./.exec(text);
    return gs1 ? gs1[1] : "";
  }

  function findGaSessionCookie(cookies) {
    var keys = Object.keys(cookies);
    for (var i = 0; i < keys.length; i++) {
      if (/^_ga_[A-Z0-9]+$/i.test(keys[i])) return cookies[keys[i]];
    }
    return "";
  }

  function parseGclCookie(value) {
    var parts = String(value || "").split(".");
    return parts.length >= 3 && parts[0] === "GCL" ? parts.slice(2).join(".") : "";
  }

  function truncate(value, max) {
    var text = value == null ? "" : String(value);
    return text.length > max ? text.slice(0, max) : text;
  }

  function normaliseHost(host) {
    return String(host || "").toLowerCase().replace(/^www\./, "");
  }

  function hostOf(url) {
    try {
      return normaliseHost(new URL(url).hostname);
    } catch (e) {
      return "";
    }
  }

  function originOf(url) {
    try {
      return new URL(url).origin + "/";
    } catch (e) {
      return "";
    }
  }

  function isSameSite(a, b) {
    return a === b || a.slice(-(b.length + 1)) === "." + b || b.slice(-(a.length + 1)) === "." + a;
  }

  function isExternalReferrer(referrer, currentUrl) {
    var from = hostOf(referrer);
    var to = hostOf(currentUrl);
    return from !== "" && to !== "" && !isSameSite(from, to);
  }

  return {
    COOKIE_NAME: COOKIE_NAME,
    MAX_COOKIE_LENGTH: MAX_COOKIE_LENGTH,
    SIGNAL_KEYS: SIGNAL_KEYS,
    parseCookies: parseCookies,
    parseGaClientId: parseGaClientId,
    parseGaSessionId: parseGaSessionId,
    findGaSessionCookie: findGaSessionCookie,
    parseGclCookie: parseGclCookie,
    truncate: truncate,
    isExternalReferrer: isExternalReferrer,
  };
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, `ℹ pass 13`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add package.json app.js tests/parsing.test.js
git commit -m "Rewrite app.js foundation with tested cookie and ID parsing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Attribution state

**Files:**
- Modify: `app.js`. Insert a STATE section and extend the returned object.
- Create: `tests/state.test.js`

**Interfaces:**
- Consumes (from Task 1): `CLICK_PARAMS`, `TOUCH_PARAMS`, `TOUCH_KEYS`, `URL_MAX`, `VALUE_MAX`, `MAX_COOKIE_LENGTH`, `truncate`, `isExternalReferrer`, `originOf`.
- Produces:
  - **State shape:** `{ v: 1, clicks: { <param>: { value: string, ts: ms } }, touch: null | { utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id, gad_source, gad_campaignid, landing_page, referrer, touch_time } }`
  - **Functions:**
    - `emptyState() → state`
    - `hasData(state) → bool`
    - `updateState(state, url, referrer, nowMs) → new state` (does not mutate its input)
    - `migrateLegacy(cookies, nowMs) → state | null`
    - `encodeState(state) → string`
    - `fitState(state) → string` (encoded, ≤ 3,500 characters in realistic cases)
    - `decodeState(raw) → state | null`

- [ ] **Step 1: Write the failing test**

Create `tests/state.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL. `parsing` gives 13 passes; every `state` test fails with `TypeError: app.updateState is not a function` or similar.

- [ ] **Step 3: Insert the STATE section**

In `app.js`, insert this block immediately before the line `  return {` (after the closing `}` of `isExternalReferrer`):

```js
  // # STATE --------------------------------------------------------------------------------------

  function emptyState() {
    return { v: 1, clicks: {}, touch: null };
  }

  function hasData(state) {
    return Object.keys(state.clicks).length > 0 || state.touch !== null;
  }

  function blankTouch(now) {
    var touch = {};
    TOUCH_KEYS.forEach(function (key) {
      touch[key] = "";
    });
    touch.touch_time = new Date(now).toISOString();
    return touch;
  }

  function readParams(url) {
    try {
      return new URL(url).searchParams;
    } catch (e) {
      return new URLSearchParams("");
    }
  }

  function updateState(state, url, referrer, now) {
    var next = { v: 1, clicks: Object.assign({}, state.clicks), touch: state.touch };
    var params = readParams(url);
    var isCampaign = false;

    CLICK_PARAMS.forEach(function (name) {
      var value = truncate(params.get(name) || "", VALUE_MAX);
      if (!value) return;
      isCampaign = true;
      var existing = next.clicks[name];
      if (!existing || existing.value !== value) {
        next.clicks[name] = { value: value, ts: now };
      }
    });

    TOUCH_PARAMS.forEach(function (name) {
      if (params.get(name)) isCampaign = true;
    });

    if (isCampaign || isExternalReferrer(referrer, url)) {
      var touch = blankTouch(now);
      TOUCH_PARAMS.forEach(function (name) {
        touch[name] = truncate(params.get(name) || "", VALUE_MAX);
      });
      touch.landing_page = truncate(url, URL_MAX);
      touch.referrer = truncate(referrer, URL_MAX);
      next.touch = touch;
    }

    return next;
  }

  function unescapeHtml(value) {
    return String(value || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  }

  /** Seeds state from the cookies written by plugin versions before 0.2.0. */
  function migrateLegacy(cookies, now) {
    var gclid = truncate(unescapeHtml(cookies._tsm_gclid), VALUE_MAX);
    var fbclid = truncate(unescapeHtml(cookies._tsm_fbclid), VALUE_MAX);
    var utm = unescapeHtml(cookies._tsm_utm);
    if (!gclid && !fbclid && !utm) return null;

    var state = emptyState();
    if (gclid) state.clicks.gclid = { value: gclid, ts: now };
    if (fbclid) state.clicks.fbclid = { value: fbclid, ts: now };
    if (utm) {
      // Legacy order: source|medium|campaign|content|term.
      var parts = utm.split("|");
      state.touch = blankTouch(now);
      state.touch.utm_source = truncate(parts[0] || "", VALUE_MAX);
      state.touch.utm_medium = truncate(parts[1] || "", VALUE_MAX);
      state.touch.utm_campaign = truncate(parts[2] || "", VALUE_MAX);
      state.touch.utm_content = truncate(parts[3] || "", VALUE_MAX);
      state.touch.utm_term = truncate(parts[4] || "", VALUE_MAX);
    }
    return state;
  }

  function encodeState(state) {
    return encodeURIComponent(JSON.stringify(state));
  }

  /** Encodes state, shrinking URLs if needed so the cookie stays under the browser's 4 KB limit. */
  function fitState(state) {
    var encoded = encodeState(state);
    if (encoded.length <= MAX_COOKIE_LENGTH || state.touch === null) return encoded;

    var touch = Object.assign({}, state.touch, { referrer: originOf(state.touch.referrer) });
    encoded = encodeState({ v: 1, clicks: state.clicks, touch: touch });
    if (encoded.length <= MAX_COOKIE_LENGTH) return encoded;

    touch.landing_page = String(touch.landing_page).split(/[?#]/)[0];
    return encodeState({ v: 1, clicks: state.clicks, touch: touch });
  }

  function decodeState(raw) {
    if (!raw) return null;
    try {
      var state = JSON.parse(decodeURIComponent(raw));
      if (!state || state.v !== 1 || typeof state.clicks !== "object" || state.clicks === null) {
        return null;
      }
      var touch = state.touch && typeof state.touch === "object" ? state.touch : null;
      return { v: 1, clicks: state.clicks, touch: touch };
    } catch (e) {
      return null;
    }
  }
```

- [ ] **Step 4: Extend the returned object**

Replace the `return { ... };` block at the end of `app.js` with:

```js
  return {
    COOKIE_NAME: COOKIE_NAME,
    MAX_COOKIE_LENGTH: MAX_COOKIE_LENGTH,
    SIGNAL_KEYS: SIGNAL_KEYS,
    parseCookies: parseCookies,
    parseGaClientId: parseGaClientId,
    parseGaSessionId: parseGaSessionId,
    findGaSessionCookie: findGaSessionCookie,
    parseGclCookie: parseGclCookie,
    truncate: truncate,
    isExternalReferrer: isExternalReferrer,
    emptyState: emptyState,
    hasData: hasData,
    updateState: updateState,
    migrateLegacy: migrateLegacy,
    encodeState: encodeState,
    fitState: fitState,
    decodeState: decodeState,
  };
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, `ℹ pass 34`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add app.js tests/state.test.js
git commit -m "Add attribution state: per-platform click IDs and last-non-direct touch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Signal resolution, field filling, cookie writing and boot

**Files:**
- Modify: `app.js`. Insert the SIGNALS, FILLING, COOKIE WRITING and BOOT sections, enable the browser branch, and extend the returned object.
- Create: `tests/fake-dom.js`, `tests/fill.test.js`

**Interfaces:**
- Consumes (from Tasks 1–2): every parsing and state function, `SIGNAL_KEYS`, `LEGACY_SELECTORS`, `COOKIE_NAME`, `MAX_AGE`.
- Produces:
  - **Functions:**
    - `resolveSignals(state, cookies) → { <each SIGNAL_KEYS key>: string }`
    - `legacyValues(state, signals) → { ga4, gclid, fbclid, utms }`
    - `fillFields(root, state, cookies)`: fills only empty `input[data-tsm-signal]` and legacy inputs
    - `candidateDomains(hostname) → string[]`
    - `findCookieDomain(doc, hostname, secure) → string`
    - `boot(window, document)`
  - **The DOM contract Task 5 must render:** `<input type='hidden' data-tsm-signal='<key>' ...>`.

- [ ] **Step 1: Write the test helpers**

Create `tests/fake-dom.js`:

```js
/**
 * Minimal browser stand-ins for testing app.js under Node.
 */

/** A cookie jar that only accepts `domain=` values listed in acceptedDomains. */
function fakeCookieJar(acceptedDomains, initial) {
  const jar = Object.assign({}, initial || {});
  const writes = [];
  return {
    jar,
    writes,
    get cookie() {
      return Object.keys(jar)
        .map((key) => key + "=" + jar[key])
        .join("; ");
    },
    set cookie(text) {
      writes.push(text);
      const [pair, ...attributes] = text.split(";").map((part) => part.trim());
      const index = pair.indexOf("=");
      const key = pair.slice(0, index);
      const domain = attributes.find((a) => a.startsWith("domain="));
      if (domain && !acceptedDomains.includes(domain.slice("domain=".length))) return;
      if (attributes.includes("max-age=0")) delete jar[key];
      else jar[key] = pair.slice(index + 1);
    },
  };
}

/** A hidden input stand-in. */
function fakeInput(attributes, value) {
  return {
    value: value || "",
    getAttribute: (name) => (name in attributes ? attributes[name] : null),
  };
}

/** A root whose querySelectorAll returns preset inputs per selector. */
function fakeRoot(bySelector) {
  return {
    querySelectorAll: (selector) => bySelector[selector] || [],
  };
}

/** A window + document pair for boot(), with event listeners that tests can fire. */
function fakePage(url, options) {
  const opts = options || {};
  const jar = fakeCookieJar(opts.domains || ["example.com"], opts.cookies);
  const listeners = {};
  const parsed = new URL(url);
  const doc = {
    get cookie() {
      return jar.cookie;
    },
    set cookie(text) {
      jar.cookie = text;
    },
    referrer: opts.referrer || "",
    readyState: opts.readyState || "complete",
    querySelectorAll: (selector) => (opts.inputs && opts.inputs[selector]) || [],
    addEventListener: (name, callback) => {
      (listeners[name] = listeners[name] || []).push(callback);
    },
  };
  const win = { location: { href: url, hostname: parsed.hostname, protocol: parsed.protocol } };
  const fire = (name, event) => (listeners[name] || []).forEach((callback) => callback(event || {}));
  return { win, doc, jar, fire };
}

module.exports = { fakeCookieJar, fakeInput, fakeRoot, fakePage };
```

- [ ] **Step 2: Write the failing test**

Create `tests/fill.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app.js");
const { fakeCookieJar, fakeInput, fakeRoot, fakePage } = require("./fake-dom.js");

const T1 = Date.UTC(2026, 9, 1, 0, 0, 0);
const SITE = "https://www.example.com";
const SIGNAL_SELECTOR = "input[data-tsm-signal]";
const LEGACY_UTMS = ".ginput_container_threesides_utms_tracking_field input[type=hidden]";

function landed(url, referrer) {
  return app.updateState(app.emptyState(), url, referrer || "", T1);
}

// # resolveSignals -------------------------------------------------------------------------------

test("resolveSignals returns every signal key", () => {
  const signals = app.resolveSignals(app.emptyState(), {});
  assert.deepEqual(Object.keys(signals).sort(), [...app.SIGNAL_KEYS].sort());
  Object.values(signals).forEach((value) => assert.equal(value, ""));
});

test("resolveSignals reads analytics cookies at fill time", () => {
  const signals = app.resolveSignals(app.emptyState(), {
    _ga: "GA1.1.111.222",
    _ga_XYZ: "GS2.1.s1760000000$o3",
    _fbp: "fb.1.1700000000000.123456789",
  });
  assert.equal(signals.ga_client_id, "111.222");
  assert.equal(signals.ga_session_id, "1760000000");
  assert.equal(signals.fbp, "fb.1.1700000000000.123456789");
});

test("gclid falls back to the _gcl_aw cookie when we have none", () => {
  const signals = app.resolveSignals(app.emptyState(), { _gcl_aw: "GCL.1760000000.FROMLINKER" });
  assert.equal(signals.gclid, "FROMLINKER");
});

test("our stored gclid wins over _gcl_aw", () => {
  const signals = app.resolveSignals(landed(SITE + "/?gclid=OURS"), { _gcl_aw: "GCL.1.THEIRS" });
  assert.equal(signals.gclid, "OURS");
});

test("braids come from the URL only", () => {
  const signals = app.resolveSignals(landed(SITE + "/?gbraid=GB&wbraid=WB"), { _gcl_gb: "GCL.1.X" });
  assert.equal(signals.gbraid, "GB");
  assert.equal(signals.wbraid, "WB");
  assert.equal(app.resolveSignals(app.emptyState(), { _gcl_gb: "GCL.1.X" }).gbraid, "");
});

test("fbc is built from our fbclid with its first-seen time when there is no _fbc", () => {
  const signals = app.resolveSignals(landed(SITE + "/?fbclid=IwAR0Ab"), {});
  assert.equal(signals.fbc, "fb.1." + T1 + ".IwAR0Ab");
});

test("an _fbc cookie for the same click is used verbatim", () => {
  const signals = app.resolveSignals(landed(SITE + "/?fbclid=IwAR0Ab"), {
    _fbc: "fb.1.1759000000000.IwAR0Ab.AbC",
  });
  assert.equal(signals.fbc, "fb.1.1759000000000.IwAR0Ab.AbC");
});

test("a stale _fbc for an older click is replaced by our newer fbclid", () => {
  const signals = app.resolveSignals(landed(SITE + "/?fbclid=NEW"), { _fbc: "fb.1.1.OLD" });
  assert.equal(signals.fbc, "fb.1." + T1 + ".NEW");
});

test("_fbc alone is passed through", () => {
  assert.equal(app.resolveSignals(app.emptyState(), { _fbc: "fb.1.1.X" }).fbc, "fb.1.1.X");
});

// # legacyValues ---------------------------------------------------------------------------------

test("legacyValues keeps the old formats", () => {
  const state = landed(SITE + "/?gclid=G&fbclid=F&utm_source=s&utm_medium=m&utm_campaign=c&utm_content=ct&utm_term=t");
  const legacy = app.legacyValues(state, app.resolveSignals(state, { _ga: "GA1.1.1.2" }));
  assert.deepEqual(legacy, { ga4: "1.2", gclid: "G", fbclid: "F", utms: "s|m|c|ct|t" });
});

test("legacy UTMs are empty, not pipes, when the touch has no UTMs", () => {
  const state = landed(SITE + "/", "https://duckduckgo.com/");
  assert.equal(app.legacyValues(state, app.resolveSignals(state, {})).utms, "");
});

// # fillFields -----------------------------------------------------------------------------------

test("fillFields fills empty new and legacy inputs", () => {
  const gclidInput = fakeInput({ "data-tsm-signal": "gclid" });
  const unknownInput = fakeInput({ "data-tsm-signal": "not_a_signal" });
  const legacyUtm = fakeInput({});
  const root = fakeRoot({ [SIGNAL_SELECTOR]: [gclidInput, unknownInput], [LEGACY_UTMS]: [legacyUtm] });

  app.fillFields(root, landed(SITE + "/?gclid=G&utm_source=s"), {});

  assert.equal(gclidInput.value, "G");
  assert.equal(unknownInput.value, "");
  assert.equal(legacyUtm.value, "s||||");
});

test("fillFields fills every matching input when a page has several forms", () => {
  const first = fakeInput({ "data-tsm-signal": "gclid" });
  const second = fakeInput({ "data-tsm-signal": "gclid" });
  app.fillFields(fakeRoot({ [SIGNAL_SELECTOR]: [first, second] }), landed(SITE + "/?gclid=G"), {});
  assert.equal(first.value, "G");
  assert.equal(second.value, "G");
});

test("fillFields never overwrites a value already in the input", () => {
  const input = fakeInput({ "data-tsm-signal": "gclid" }, "FROM_PAGE_1");
  app.fillFields(fakeRoot({ [SIGNAL_SELECTOR]: [input] }), landed(SITE + "/?gclid=NEW"), {});
  assert.equal(input.value, "FROM_PAGE_1");
});

// # Cookie domain --------------------------------------------------------------------------------

test("candidateDomains lists suffixes from broadest to narrowest", () => {
  assert.deepEqual(app.candidateDomains("www.example.com.au"), [
    "com.au",
    "example.com.au",
    "www.example.com.au",
  ]);
  assert.deepEqual(app.candidateDomains("localhost"), []);
  assert.deepEqual(app.candidateDomains("192.168.1.10"), []);
  assert.deepEqual(app.candidateDomains("::1"), []);
});

test("findCookieDomain picks the broadest accepted domain and cleans up its probe", () => {
  const doc = fakeCookieJar(["example.com.au", "www.example.com.au"]);
  assert.equal(app.findCookieDomain(doc, "www.example.com.au", true), "example.com.au");
  assert.equal("_tsm_probe" in doc.jar, false);
});

test("findCookieDomain falls back to host-only", () => {
  assert.equal(app.findCookieDomain(fakeCookieJar([]), "localhost", false), "");
});

// # boot -----------------------------------------------------------------------------------------

test("boot stores a landing click in a root-domain cookie and fills the form", () => {
  const input = fakeInput({ "data-tsm-signal": "gclid" });
  const page = fakePage(SITE + "/?gclid=G1", { inputs: { [SIGNAL_SELECTOR]: [input] } });

  app.boot(page.win, page.doc);

  const written = page.jar.writes.find((w) => w.startsWith(app.COOKIE_NAME + "="));
  assert.match(written, /; domain=example\.com/);
  assert.match(written, /; max-age=7776000/);
  assert.match(written, /; Secure/);
  assert.equal(app.decodeState(page.jar.jar[app.COOKIE_NAME]).clicks.gclid.value, "G1");
  assert.equal(input.value, "G1");
});

test("boot does not write a cookie for a direct visit with no history", () => {
  const page = fakePage(SITE + "/about");
  app.boot(page.win, page.doc);
  assert.equal(page.jar.writes.length, 0);
});

test("boot does not rewrite an unchanged cookie", () => {
  const first = fakePage(SITE + "/?gclid=G1");
  app.boot(first.win, first.doc);

  const second = fakePage(SITE + "/contact", { cookies: { [app.COOKIE_NAME]: first.jar.jar[app.COOKIE_NAME] } });
  app.boot(second.win, second.doc);
  assert.equal(second.jar.writes.length, 0);
});

test("boot migrates legacy cookies", () => {
  const page = fakePage(SITE + "/contact", { cookies: { _tsm_gclid: "OLDG" } });
  app.boot(page.win, page.doc);
  assert.equal(app.decodeState(page.jar.jar[app.COOKIE_NAME]).clicks.gclid.value, "OLDG");
});

test("boot waits for DOMContentLoaded while the document is loading", () => {
  const input = fakeInput({ "data-tsm-signal": "gclid" });
  const page = fakePage(SITE + "/?gclid=G1", { readyState: "loading", inputs: { [SIGNAL_SELECTOR]: [input] } });

  app.boot(page.win, page.doc);
  assert.equal(input.value, "");

  page.fire("DOMContentLoaded");
  assert.equal(input.value, "G1");
});

test("boot refills after gform/post_render", () => {
  const inputs = { [SIGNAL_SELECTOR]: [] };
  const page = fakePage(SITE + "/?gclid=G1", { inputs });
  app.boot(page.win, page.doc);

  const ajaxInput = fakeInput({ "data-tsm-signal": "gclid" });
  inputs[SIGNAL_SELECTOR] = [ajaxInput];
  page.fire("gform/post_render");
  assert.equal(ajaxInput.value, "G1");
});

test("boot fills Gravity Forms on submit with cookies set after page load", () => {
  const page = fakePage(SITE + "/contact");
  app.boot(page.win, page.doc);

  page.jar.jar._ga = "GA1.1.999.888";
  const gaInput = fakeInput({ "data-tsm-signal": "ga_client_id" });
  const form = Object.assign(fakeRoot({ [SIGNAL_SELECTOR]: [gaInput] }), { id: "gform_3" });
  page.fire("submit", { target: form });
  assert.equal(gaInput.value, "999.888");

  const otherInput = fakeInput({ "data-tsm-signal": "ga_client_id" });
  const otherForm = Object.assign(fakeRoot({ [SIGNAL_SELECTOR]: [otherInput] }), { id: "search" });
  page.fire("submit", { target: otherForm });
  assert.equal(otherInput.value, "");
});

test("boot still fills from the URL when cookie access throws", () => {
  const input = fakeInput({ "data-tsm-signal": "gclid" });
  const page = fakePage(SITE + "/?gclid=G1", { inputs: { [SIGNAL_SELECTOR]: [input] } });
  Object.defineProperty(page.doc, "cookie", {
    get() {
      throw new Error("SecurityError");
    },
    set() {
      throw new Error("SecurityError");
    },
  });

  assert.doesNotThrow(() => app.boot(page.win, page.doc));
  assert.equal(input.value, "G1");
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL. 34 pass; the `fill` tests fail with `TypeError: app.resolveSignals is not a function` or similar.

- [ ] **Step 4: Insert the remaining sections**

In `app.js`, insert this block immediately before the line `  return {` (after the closing `}` of `decodeState`):

```js
  // # SIGNALS ------------------------------------------------------------------------------------

  function clickValue(state, name) {
    var click = state.clicks[name];
    return click && typeof click.value === "string" ? click.value : "";
  }

  function resolveFbc(state, cookies) {
    var fbclid = state.clicks.fbclid;
    var existing = cookies._fbc || "";
    if (fbclid && fbclid.value && existing.indexOf("." + fbclid.value) === -1) {
      return "fb.1." + fbclid.ts + "." + fbclid.value;
    }
    return existing;
  }

  function resolveSignals(state, cookies) {
    var touch = state.touch || {};
    var signals = {
      ga_client_id: parseGaClientId(cookies._ga),
      ga_session_id: parseGaSessionId(findGaSessionCookie(cookies)),
      gclid: clickValue(state, "gclid") || parseGclCookie(cookies._gcl_aw),
      gbraid: clickValue(state, "gbraid"),
      wbraid: clickValue(state, "wbraid"),
      fbc: resolveFbc(state, cookies),
      fbp: cookies._fbp || "",
      msclkid: clickValue(state, "msclkid"),
      li_fat_id: clickValue(state, "li_fat_id"),
      ttclid: clickValue(state, "ttclid"),
    };
    TOUCH_KEYS.forEach(function (key) {
      signals[key] = typeof touch[key] === "string" ? touch[key] : "";
    });
    return signals;
  }

  function legacyValues(state, signals) {
    var utms = [
      signals.utm_source, signals.utm_medium, signals.utm_campaign, signals.utm_content, signals.utm_term,
    ];
    return {
      ga4: signals.ga_client_id,
      gclid: signals.gclid,
      fbclid: clickValue(state, "fbclid"),
      utms: utms.join("") ? utms.join("|") : "",
    };
  }

  // # FILLING ------------------------------------------------------------------------------------

  function fillEmpty(input, value) {
    if (input && input.value === "" && value) input.value = value;
  }

  function forEachNode(nodes, callback) {
    Array.prototype.forEach.call(nodes, callback);
  }

  /** Fills empty inputs only, so multi-page and save-and-continue values are never overwritten. */
  function fillFields(root, state, cookies) {
    var signals = resolveSignals(state, cookies);
    var legacy = legacyValues(state, signals);

    forEachNode(root.querySelectorAll("input[data-tsm-signal]"), function (input) {
      fillEmpty(input, signals[input.getAttribute("data-tsm-signal")]);
    });

    Object.keys(LEGACY_SELECTORS).forEach(function (name) {
      forEachNode(root.querySelectorAll(LEGACY_SELECTORS[name]), function (input) {
        fillEmpty(input, legacy[name]);
      });
    });
  }

  // # COOKIE WRITING -----------------------------------------------------------------------------

  function candidateDomains(hostname) {
    var host = String(hostname || "").toLowerCase();
    if (host.indexOf(".") === -1 || host.indexOf(":") !== -1 || /^[\d.]+$/.test(host)) return [];
    var labels = host.split(".");
    var domains = [];
    for (var i = labels.length - 2; i >= 0; i--) {
      domains.push(labels.slice(i).join("."));
    }
    return domains;
  }

  /** Finds the broadest domain the browser accepts (it rejects public suffixes like com.au). */
  function findCookieDomain(doc, hostname, secure) {
    var candidates = candidateDomains(hostname);
    for (var i = 0; i < candidates.length; i++) {
      var attributes = "; path=/; SameSite=Lax; domain=" + candidates[i] + (secure ? "; Secure" : "");
      doc.cookie = "_tsm_probe=1" + attributes;
      if (parseCookies(doc.cookie)._tsm_probe === "1") {
        doc.cookie = "_tsm_probe=; max-age=0" + attributes;
        return candidates[i];
      }
    }
    return "";
  }

  function writeState(doc, encoded, hostname, secure) {
    var domain = findCookieDomain(doc, hostname, secure);
    doc.cookie = COOKIE_NAME + "=" + encoded + "; path=/; max-age=" + MAX_AGE + "; SameSite=Lax" +
      (domain ? "; domain=" + domain : "") + (secure ? "; Secure" : "");
  }

  // # BOOT ---------------------------------------------------------------------------------------

  /** Cookie access throws in sandboxed iframes and some privacy modes; treat that as no cookies. */
  function readCookies(doc) {
    try {
      return parseCookies(doc.cookie);
    } catch (e) {
      return {};
    }
  }

  function boot(win, doc) {
    var location = win.location;
    var secure = location.protocol === "https:";
    var cookies = readCookies(doc);
    var now = Date.now();
    var state = decodeState(cookies[COOKIE_NAME]) || migrateLegacy(cookies, now) || emptyState();

    state = updateState(state, location.href, doc.referrer, now);

    var encoded = fitState(state);
    if (hasData(state) && encoded !== cookies[COOKIE_NAME]) {
      try {
        writeState(doc, encoded, location.hostname, secure);
      } catch (e) {
        // Cookies blocked: this page view can still fill forms from the URL.
      }
    }

    var fillDocument = function () {
      fillFields(doc, state, readCookies(doc));
    };

    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", fillDocument);
    } else {
      fillDocument();
    }

    // AJAX-rendered forms and multi-page navigation.
    doc.addEventListener("gform/post_render", fillDocument);

    // Re-read cookies at submit: GA4 and the Meta Pixel may set _ga/_fbp after page load.
    doc.addEventListener(
      "submit",
      function (event) {
        var form = event.target;
        if (form && typeof form.id === "string" && form.id.indexOf("gform_") === 0) {
          fillFields(form, state, readCookies(doc));
        }
      },
      true
    );
  }
```

- [ ] **Step 5: Enable the browser branch**

At the top of `app.js`, replace:

```js
  if (typeof window === "undefined") {
    module.exports = api;
  }
})(function () {
```

with:

```js
  if (typeof window === "undefined") {
    module.exports = api;
  } else {
    api.boot(window, document);
  }
})(function () {
```

- [ ] **Step 6: Extend the returned object**

Replace the `return { ... };` block at the end of `app.js` with:

```js
  return {
    COOKIE_NAME: COOKIE_NAME,
    MAX_COOKIE_LENGTH: MAX_COOKIE_LENGTH,
    SIGNAL_KEYS: SIGNAL_KEYS,
    parseCookies: parseCookies,
    parseGaClientId: parseGaClientId,
    parseGaSessionId: parseGaSessionId,
    findGaSessionCookie: findGaSessionCookie,
    parseGclCookie: parseGclCookie,
    truncate: truncate,
    isExternalReferrer: isExternalReferrer,
    emptyState: emptyState,
    hasData: hasData,
    updateState: updateState,
    migrateLegacy: migrateLegacy,
    encodeState: encodeState,
    fitState: fitState,
    decodeState: decodeState,
    resolveSignals: resolveSignals,
    legacyValues: legacyValues,
    fillFields: fillFields,
    candidateDomains: candidateDomains,
    findCookieDomain: findCookieDomain,
    boot: boot,
  };
});
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, `ℹ pass 59`, `ℹ fail 0`.

- [ ] **Step 8: Check the finished file**

Your `app.js` should now be exactly this:

<details><summary>Complete app.js</summary>

```js
/**
 * Threesides Gravity Forms Tracking Connector.
 *
 * Runs on every front-end page: captures ad click IDs, UTMs and landing context into a
 * first-party cookie, then fills Tracking Signals (and legacy) fields in Gravity Forms.
 */
(function (factory) {
  var api = factory();
  if (typeof window === "undefined") {
    module.exports = api;
  } else {
    api.boot(window, document);
  }
})(function () {
  "use strict";

  var COOKIE_NAME = "_tsm_attr";
  var MAX_AGE = 90 * 24 * 60 * 60;
  var MAX_COOKIE_LENGTH = 3500;
  var URL_MAX = 500;
  var VALUE_MAX = 255;

  var CLICK_PARAMS = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "li_fat_id", "ttclid"];
  var TOUCH_PARAMS = [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
    "gad_source", "gad_campaignid",
  ];
  var TOUCH_KEYS = TOUCH_PARAMS.concat(["landing_page", "referrer", "touch_time"]);

  // Must match ThreesidesTrackingSignals::all() — enforced by tests/registry.test.js.
  var SIGNAL_KEYS = [
    "ga_client_id", "ga_session_id", "gclid", "gbraid", "wbraid", "gad_source", "gad_campaignid",
    "fbc", "fbp", "msclkid", "li_fat_id", "ttclid", "utm_source", "utm_medium", "utm_campaign",
    "utm_term", "utm_content", "utm_id", "landing_page", "referrer", "touch_time",
  ];

  var LEGACY_SELECTORS = {
    ga4: ".ginput_container_threesides_ga4_client_id_tracking_field input[type=hidden]",
    gclid: ".ginput_container_threesides_gclid_tracking_field input[type=hidden]",
    fbclid: ".ginput_container_threesides_fbclid_tracking_field input[type=hidden]",
    utms: ".ginput_container_threesides_utms_tracking_field input[type=hidden]",
  };

  // # PARSING ------------------------------------------------------------------------------------

  function parseCookies(cookieString) {
    var cookies = {};
    String(cookieString || "").split(";").forEach(function (pair) {
      var index = pair.indexOf("=");
      if (index === -1) return;
      var key = pair.slice(0, index).trim();
      if (key && !Object.prototype.hasOwnProperty.call(cookies, key)) {
        cookies[key] = pair.slice(index + 1).trim();
      }
    });
    return cookies;
  }

  function parseGaClientId(value) {
    var parts = String(value || "").split(".");
    return parts.length >= 4 ? parts.slice(-2).join(".") : "";
  }

  function parseGaSessionId(value) {
    var text = String(value || "");
    var gs2 = /^GS2\.\d+\.s(\d+)/.exec(text);
    if (gs2) return gs2[1];
    var gs1 = /^GS1\.\d+\.(\d+)\./.exec(text);
    return gs1 ? gs1[1] : "";
  }

  function findGaSessionCookie(cookies) {
    var keys = Object.keys(cookies);
    for (var i = 0; i < keys.length; i++) {
      if (/^_ga_[A-Z0-9]+$/i.test(keys[i])) return cookies[keys[i]];
    }
    return "";
  }

  function parseGclCookie(value) {
    var parts = String(value || "").split(".");
    return parts.length >= 3 && parts[0] === "GCL" ? parts.slice(2).join(".") : "";
  }

  function truncate(value, max) {
    var text = value == null ? "" : String(value);
    return text.length > max ? text.slice(0, max) : text;
  }

  function normaliseHost(host) {
    return String(host || "").toLowerCase().replace(/^www\./, "");
  }

  function hostOf(url) {
    try {
      return normaliseHost(new URL(url).hostname);
    } catch (e) {
      return "";
    }
  }

  function originOf(url) {
    try {
      return new URL(url).origin + "/";
    } catch (e) {
      return "";
    }
  }

  function isSameSite(a, b) {
    return a === b || a.slice(-(b.length + 1)) === "." + b || b.slice(-(a.length + 1)) === "." + a;
  }

  function isExternalReferrer(referrer, currentUrl) {
    var from = hostOf(referrer);
    var to = hostOf(currentUrl);
    return from !== "" && to !== "" && !isSameSite(from, to);
  }

  // # STATE --------------------------------------------------------------------------------------

  function emptyState() {
    return { v: 1, clicks: {}, touch: null };
  }

  function hasData(state) {
    return Object.keys(state.clicks).length > 0 || state.touch !== null;
  }

  function blankTouch(now) {
    var touch = {};
    TOUCH_KEYS.forEach(function (key) {
      touch[key] = "";
    });
    touch.touch_time = new Date(now).toISOString();
    return touch;
  }

  function readParams(url) {
    try {
      return new URL(url).searchParams;
    } catch (e) {
      return new URLSearchParams("");
    }
  }

  function updateState(state, url, referrer, now) {
    var next = { v: 1, clicks: Object.assign({}, state.clicks), touch: state.touch };
    var params = readParams(url);
    var isCampaign = false;

    CLICK_PARAMS.forEach(function (name) {
      var value = truncate(params.get(name) || "", VALUE_MAX);
      if (!value) return;
      isCampaign = true;
      var existing = next.clicks[name];
      if (!existing || existing.value !== value) {
        next.clicks[name] = { value: value, ts: now };
      }
    });

    TOUCH_PARAMS.forEach(function (name) {
      if (params.get(name)) isCampaign = true;
    });

    if (isCampaign || isExternalReferrer(referrer, url)) {
      var touch = blankTouch(now);
      TOUCH_PARAMS.forEach(function (name) {
        touch[name] = truncate(params.get(name) || "", VALUE_MAX);
      });
      touch.landing_page = truncate(url, URL_MAX);
      touch.referrer = truncate(referrer, URL_MAX);
      next.touch = touch;
    }

    return next;
  }

  function unescapeHtml(value) {
    return String(value || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  }

  /** Seeds state from the cookies written by plugin versions before 0.2.0. */
  function migrateLegacy(cookies, now) {
    var gclid = truncate(unescapeHtml(cookies._tsm_gclid), VALUE_MAX);
    var fbclid = truncate(unescapeHtml(cookies._tsm_fbclid), VALUE_MAX);
    var utm = unescapeHtml(cookies._tsm_utm);
    if (!gclid && !fbclid && !utm) return null;

    var state = emptyState();
    if (gclid) state.clicks.gclid = { value: gclid, ts: now };
    if (fbclid) state.clicks.fbclid = { value: fbclid, ts: now };
    if (utm) {
      // Legacy order: source|medium|campaign|content|term.
      var parts = utm.split("|");
      state.touch = blankTouch(now);
      state.touch.utm_source = truncate(parts[0] || "", VALUE_MAX);
      state.touch.utm_medium = truncate(parts[1] || "", VALUE_MAX);
      state.touch.utm_campaign = truncate(parts[2] || "", VALUE_MAX);
      state.touch.utm_content = truncate(parts[3] || "", VALUE_MAX);
      state.touch.utm_term = truncate(parts[4] || "", VALUE_MAX);
    }
    return state;
  }

  function encodeState(state) {
    return encodeURIComponent(JSON.stringify(state));
  }

  /** Encodes state, shrinking URLs if needed so the cookie stays under the browser's 4 KB limit. */
  function fitState(state) {
    var encoded = encodeState(state);
    if (encoded.length <= MAX_COOKIE_LENGTH || state.touch === null) return encoded;

    var touch = Object.assign({}, state.touch, { referrer: originOf(state.touch.referrer) });
    encoded = encodeState({ v: 1, clicks: state.clicks, touch: touch });
    if (encoded.length <= MAX_COOKIE_LENGTH) return encoded;

    touch.landing_page = String(touch.landing_page).split(/[?#]/)[0];
    return encodeState({ v: 1, clicks: state.clicks, touch: touch });
  }

  function decodeState(raw) {
    if (!raw) return null;
    try {
      var state = JSON.parse(decodeURIComponent(raw));
      if (!state || state.v !== 1 || typeof state.clicks !== "object" || state.clicks === null) {
        return null;
      }
      var touch = state.touch && typeof state.touch === "object" ? state.touch : null;
      return { v: 1, clicks: state.clicks, touch: touch };
    } catch (e) {
      return null;
    }
  }

  // # SIGNALS ------------------------------------------------------------------------------------

  function clickValue(state, name) {
    var click = state.clicks[name];
    return click && typeof click.value === "string" ? click.value : "";
  }

  function resolveFbc(state, cookies) {
    var fbclid = state.clicks.fbclid;
    var existing = cookies._fbc || "";
    if (fbclid && fbclid.value && existing.indexOf("." + fbclid.value) === -1) {
      return "fb.1." + fbclid.ts + "." + fbclid.value;
    }
    return existing;
  }

  function resolveSignals(state, cookies) {
    var touch = state.touch || {};
    var signals = {
      ga_client_id: parseGaClientId(cookies._ga),
      ga_session_id: parseGaSessionId(findGaSessionCookie(cookies)),
      gclid: clickValue(state, "gclid") || parseGclCookie(cookies._gcl_aw),
      gbraid: clickValue(state, "gbraid"),
      wbraid: clickValue(state, "wbraid"),
      fbc: resolveFbc(state, cookies),
      fbp: cookies._fbp || "",
      msclkid: clickValue(state, "msclkid"),
      li_fat_id: clickValue(state, "li_fat_id"),
      ttclid: clickValue(state, "ttclid"),
    };
    TOUCH_KEYS.forEach(function (key) {
      signals[key] = typeof touch[key] === "string" ? touch[key] : "";
    });
    return signals;
  }

  function legacyValues(state, signals) {
    var utms = [
      signals.utm_source, signals.utm_medium, signals.utm_campaign, signals.utm_content, signals.utm_term,
    ];
    return {
      ga4: signals.ga_client_id,
      gclid: signals.gclid,
      fbclid: clickValue(state, "fbclid"),
      utms: utms.join("") ? utms.join("|") : "",
    };
  }

  // # FILLING ------------------------------------------------------------------------------------

  function fillEmpty(input, value) {
    if (input && input.value === "" && value) input.value = value;
  }

  function forEachNode(nodes, callback) {
    Array.prototype.forEach.call(nodes, callback);
  }

  /** Fills empty inputs only, so multi-page and save-and-continue values are never overwritten. */
  function fillFields(root, state, cookies) {
    var signals = resolveSignals(state, cookies);
    var legacy = legacyValues(state, signals);

    forEachNode(root.querySelectorAll("input[data-tsm-signal]"), function (input) {
      fillEmpty(input, signals[input.getAttribute("data-tsm-signal")]);
    });

    Object.keys(LEGACY_SELECTORS).forEach(function (name) {
      forEachNode(root.querySelectorAll(LEGACY_SELECTORS[name]), function (input) {
        fillEmpty(input, legacy[name]);
      });
    });
  }

  // # COOKIE WRITING -----------------------------------------------------------------------------

  function candidateDomains(hostname) {
    var host = String(hostname || "").toLowerCase();
    if (host.indexOf(".") === -1 || host.indexOf(":") !== -1 || /^[\d.]+$/.test(host)) return [];
    var labels = host.split(".");
    var domains = [];
    for (var i = labels.length - 2; i >= 0; i--) {
      domains.push(labels.slice(i).join("."));
    }
    return domains;
  }

  /** Finds the broadest domain the browser accepts (it rejects public suffixes like com.au). */
  function findCookieDomain(doc, hostname, secure) {
    var candidates = candidateDomains(hostname);
    for (var i = 0; i < candidates.length; i++) {
      var attributes = "; path=/; SameSite=Lax; domain=" + candidates[i] + (secure ? "; Secure" : "");
      doc.cookie = "_tsm_probe=1" + attributes;
      if (parseCookies(doc.cookie)._tsm_probe === "1") {
        doc.cookie = "_tsm_probe=; max-age=0" + attributes;
        return candidates[i];
      }
    }
    return "";
  }

  function writeState(doc, encoded, hostname, secure) {
    var domain = findCookieDomain(doc, hostname, secure);
    doc.cookie = COOKIE_NAME + "=" + encoded + "; path=/; max-age=" + MAX_AGE + "; SameSite=Lax" +
      (domain ? "; domain=" + domain : "") + (secure ? "; Secure" : "");
  }

  // # BOOT ---------------------------------------------------------------------------------------

  /** Cookie access throws in sandboxed iframes and some privacy modes; treat that as no cookies. */
  function readCookies(doc) {
    try {
      return parseCookies(doc.cookie);
    } catch (e) {
      return {};
    }
  }

  function boot(win, doc) {
    var location = win.location;
    var secure = location.protocol === "https:";
    var cookies = readCookies(doc);
    var now = Date.now();
    var state = decodeState(cookies[COOKIE_NAME]) || migrateLegacy(cookies, now) || emptyState();

    state = updateState(state, location.href, doc.referrer, now);

    var encoded = fitState(state);
    if (hasData(state) && encoded !== cookies[COOKIE_NAME]) {
      try {
        writeState(doc, encoded, location.hostname, secure);
      } catch (e) {
        // Cookies blocked: this page view can still fill forms from the URL.
      }
    }

    var fillDocument = function () {
      fillFields(doc, state, readCookies(doc));
    };

    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", fillDocument);
    } else {
      fillDocument();
    }

    // AJAX-rendered forms and multi-page navigation.
    doc.addEventListener("gform/post_render", fillDocument);

    // Re-read cookies at submit: GA4 and the Meta Pixel may set _ga/_fbp after page load.
    doc.addEventListener(
      "submit",
      function (event) {
        var form = event.target;
        if (form && typeof form.id === "string" && form.id.indexOf("gform_") === 0) {
          fillFields(form, state, readCookies(doc));
        }
      },
      true
    );
  }

  return {
    COOKIE_NAME: COOKIE_NAME,
    MAX_COOKIE_LENGTH: MAX_COOKIE_LENGTH,
    SIGNAL_KEYS: SIGNAL_KEYS,
    parseCookies: parseCookies,
    parseGaClientId: parseGaClientId,
    parseGaSessionId: parseGaSessionId,
    findGaSessionCookie: findGaSessionCookie,
    parseGclCookie: parseGclCookie,
    truncate: truncate,
    isExternalReferrer: isExternalReferrer,
    emptyState: emptyState,
    hasData: hasData,
    updateState: updateState,
    migrateLegacy: migrateLegacy,
    encodeState: encodeState,
    fitState: fitState,
    decodeState: decodeState,
    resolveSignals: resolveSignals,
    legacyValues: legacyValues,
    fillFields: fillFields,
    candidateDomains: candidateDomains,
    findCookieDomain: findCookieDomain,
    boot: boot,
  };
});
```

</details>

- [ ] **Step 9: Commit**

```bash
git add app.js tests/fake-dom.js tests/fill.test.js
git commit -m "Fill tracking and legacy fields from stored signals; boot site-wide

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Signal registry

**Files:**
- Create: `class-ThreesidesTrackingSignals.php`
- Create: `tests/registry.test.js`

**Interfaces:**
- Consumes (from Task 1): `SIGNAL_KEYS` in `app.js`.
- Produces:
  - `ThreesidesTrackingSignals::all() → array` of `array('input' => int, 'key' => string, 'label' => string)` in display order
  - `::find_by_input($suffix) → array|null`
  - `::is_url($key) → bool`
  - `::max_length($key) → int` (500 for URLs, 255 otherwise)
  - The registry test parses each `all()` row with the regex `array\('input' => (\d+), 'key' => '([a-z0-9_]+)'`. Keep each row on one line in exactly that shape.

- [ ] **Step 1: Write the failing test**

Create `tests/registry.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, `ENOENT: no such file or directory ... class-ThreesidesTrackingSignals.php`.

- [ ] **Step 3: Write the registry**

Create `class-ThreesidesTrackingSignals.php`:

```php
<?php

/** Tracking Signals registry: the single list of signals the Tracking Signals field collects. */

if (! class_exists('GFForms')) {
    die();
}

class ThreesidesTrackingSignals
{

    /**
     * Every signal, in display order.
     *
     * Input suffixes become sub-input IDs (field 5, input 3 => "5.3") and are stored in entries and
     * feed mappings, so they are permanent: append new signals, never renumber or reuse a suffix,
     * and never use a suffix ending in 0 (Gravity Forms treats "5.10" as "5.1").
     *
     * Keys must match SIGNAL_KEYS in app.js (enforced by tests/registry.test.js).
     *
     * @return array[] Each signal: input (int), key (string), label (string).
     */
    public static function all()
    {
        return array(
            array('input' => 1, 'key' => 'ga_client_id', 'label' => __('GA4 Client ID', 'threesides-gf-tracking-connector')),
            array('input' => 2, 'key' => 'ga_session_id', 'label' => __('GA4 Session ID', 'threesides-gf-tracking-connector')),
            array('input' => 3, 'key' => 'gclid', 'label' => __('GCLID', 'threesides-gf-tracking-connector')),
            array('input' => 4, 'key' => 'gbraid', 'label' => __('GBRAID', 'threesides-gf-tracking-connector')),
            array('input' => 5, 'key' => 'wbraid', 'label' => __('WBRAID', 'threesides-gf-tracking-connector')),
            array('input' => 6, 'key' => 'gad_source', 'label' => __('gad_source', 'threesides-gf-tracking-connector')),
            array('input' => 7, 'key' => 'gad_campaignid', 'label' => __('gad_campaignid', 'threesides-gf-tracking-connector')),
            array('input' => 8, 'key' => 'fbc', 'label' => __('Meta fbc', 'threesides-gf-tracking-connector')),
            array('input' => 9, 'key' => 'fbp', 'label' => __('Meta fbp', 'threesides-gf-tracking-connector')),
            array('input' => 11, 'key' => 'msclkid', 'label' => __('Microsoft Click ID', 'threesides-gf-tracking-connector')),
            array('input' => 12, 'key' => 'li_fat_id', 'label' => __('LinkedIn li_fat_id', 'threesides-gf-tracking-connector')),
            array('input' => 13, 'key' => 'ttclid', 'label' => __('TikTok ttclid', 'threesides-gf-tracking-connector')),
            array('input' => 14, 'key' => 'utm_source', 'label' => __('utm_source', 'threesides-gf-tracking-connector')),
            array('input' => 15, 'key' => 'utm_medium', 'label' => __('utm_medium', 'threesides-gf-tracking-connector')),
            array('input' => 16, 'key' => 'utm_campaign', 'label' => __('utm_campaign', 'threesides-gf-tracking-connector')),
            array('input' => 17, 'key' => 'utm_term', 'label' => __('utm_term', 'threesides-gf-tracking-connector')),
            array('input' => 18, 'key' => 'utm_content', 'label' => __('utm_content', 'threesides-gf-tracking-connector')),
            array('input' => 19, 'key' => 'utm_id', 'label' => __('utm_id', 'threesides-gf-tracking-connector')),
            array('input' => 21, 'key' => 'landing_page', 'label' => __('Landing Page', 'threesides-gf-tracking-connector')),
            array('input' => 22, 'key' => 'referrer', 'label' => __('Referrer', 'threesides-gf-tracking-connector')),
            array('input' => 23, 'key' => 'touch_time', 'label' => __('Touch Timestamp', 'threesides-gf-tracking-connector')),
        );
    }

    /**
     * @param int|string $suffix The part of a sub-input ID after the dot.
     *
     * @return array|null The signal, or null if the suffix is unknown.
     */
    public static function find_by_input($suffix)
    {
        foreach (self::all() as $signal) {
            if ($signal['input'] === (int) $suffix) {
                return $signal;
            }
        }

        return null;
    }

    /**
     * @param string $key A signal key.
     *
     * @return bool Whether the signal holds a URL.
     */
    public static function is_url($key)
    {
        return in_array($key, array('landing_page', 'referrer'), true);
    }

    /**
     * Mirrors the truncation limits in app.js.
     *
     * @param string $key A signal key.
     *
     * @return int Maximum stored length.
     */
    public static function max_length($key)
    {
        return self::is_url($key) ? 500 : 255;
    }
}
```

- [ ] **Step 4: Run the tests and lint**

Run: `npm test`
Expected: PASS, `ℹ pass 63`, `ℹ fail 0`.

Run: `php -l class-ThreesidesTrackingSignals.php`
Expected: `No syntax errors detected`.

- [ ] **Step 5: Commit**

```bash
git add class-ThreesidesTrackingSignals.php tests/registry.test.js
git commit -m "Add tracking signal registry with permanent sub-input IDs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Tracking Signals field

**Files:**
- Create: `tests/php/bootstrap.php`, `tests/php/field-test.php`
- Create: `class-ThreesidesTrackingField.php`
- Modify: `package.json` (`test` script)

**Interfaces:**
- Consumes (from Task 4): `ThreesidesTrackingSignals::all()`, `::find_by_input()`, `::is_url()`, `::max_length()`. From Task 3: the `data-tsm-signal` contract.
- Produces:
  - **Class:** `ThreesidesTrackingField` (type `threesides_tracking_field`), registered via `GF_Fields::register`.
  - **Static methods:**
    - `ThreesidesTrackingField::render_signals_setting($position)`, which Task 7 hooks to `gform_field_standard_settings` (it renders at position 1100)
    - `::default_inputs($field_id)`
    - `::maybe_add_field_group($field_groups)`
  - **Editor contract:**
    - The setting container `#threesides_tracking_signals_container` sits inside `.custom_inputs_setting`.
    - The preview renders `label[for=input_<field>_<n>]` and `#input_<field>_<n>_container` for core's `GetCustomizeInputsUI` and `SetInputHidden`.
  - **Front-end input:** `<input type='hidden' name='input_<field>.<n>' id='input_<form>_<field>_<n>' value='…' data-tsm-signal='<key>' />` per enabled signal.

How the test harness works: `tests/php/bootstrap.php` defines just enough of `GF_Field`, `GF_Fields` and the WordPress escaping and sanitising functions to run the field class with plain `php`. The stand-ins approximate core. What they verify is our logic, not WordPress itself. Real Gravity Forms behaviour is covered by the manual checklist in Task 8.

- [ ] **Step 1: Write the harness**

Create `tests/php/bootstrap.php`:

```php
<?php

/**
 * Minimal WordPress / Gravity Forms stand-ins so the field class can be tested with plain PHP.
 * They approximate core behaviour only as far as the tests need; they are not a WordPress port.
 */

class GFForms
{
}

class GF_Fields
{
    public static $registered = array();

    public static function register($field)
    {
        self::$registered[$field->type] = $field;
    }
}

class GF_Field
{
    public $id;
    public $type;
    public $inputs;
    public $test_context = 'frontend';

    public function __construct($properties = array())
    {
        foreach ($properties as $name => $value) {
            $this->$name = $value;
        }
    }

    public function is_form_editor()
    {
        return $this->test_context === 'editor';
    }

    public function is_entry_detail()
    {
        return $this->test_context === 'entry_detail';
    }

    public function add_button($field_groups)
    {
        return $field_groups;
    }

    public function get_field_content($value, $force_frontend_label, $form)
    {
        return 'PARENT_CONTENT';
    }

    public function get_value_entry_detail($value, $entry = array(), $use_text = false, $format = 'html', $media = 'screen')
    {
        return 'PARENT:' . $value;
    }

    public function get_value_merge_tag($value, $input_id, $entry, $form, $modifier, $raw_value, $url_encode, $esc_html, $format, $nl2br)
    {
        return 'PARENT:' . $value;
    }

    public function get_value_export($entry, $input_id = '', $use_text = false, $is_csv = false)
    {
        return rgar($entry, $input_id);
    }

    public function get_value_entry_list($value, $entry, $field_id, $columns, $form)
    {
        return 'PARENT:' . $value;
    }
}

function __($text, $domain = 'default')
{
    return $text;
}

function _n($single, $plural, $number, $domain = 'default')
{
    return $number == 1 ? $single : $plural;
}

function esc_html($text)
{
    return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
}

function esc_attr($text)
{
    return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
}

function esc_attr__($text, $domain = 'default')
{
    return esc_attr($text);
}

function esc_html__($text, $domain = 'default')
{
    return esc_html($text);
}

function esc_html_e($text, $domain = 'default')
{
    echo esc_html($text);
}

function wp_json_encode($data)
{
    return json_encode($data);
}

function absint($value)
{
    return abs((int) $value);
}

function rgar($array, $key)
{
    return is_array($array) && isset($array[$key]) ? $array[$key] : '';
}

function rgblank($value)
{
    return $value === null || $value === '' || $value === array();
}

function sanitize_text_field($text)
{
    return trim(preg_replace('/\s+/', ' ', strip_tags((string) $text)));
}

function esc_url_raw($url)
{
    return preg_match('#^https?://#i', (string) $url) ? str_replace(array('"', "'", '<', '>', ' '), '', (string) $url) : '';
}

// # A tiny test runner -------------------------------------------------------------------------

$GLOBALS['tsm_failures'] = 0;
$GLOBALS['tsm_passes'] = 0;

function check($name, $actual, $expected)
{
    if ($actual === $expected) {
        $GLOBALS['tsm_passes']++;
        return;
    }
    $GLOBALS['tsm_failures']++;
    fwrite(STDERR, "FAIL: {$name}\n  expected: " . var_export($expected, true) . "\n  actual:   " . var_export($actual, true) . "\n");
}

function check_contains($name, $haystack, $needle)
{
    check($name . ' (contains ' . $needle . ')', strpos($haystack, $needle) !== false, true);
}

function check_not_contains($name, $haystack, $needle)
{
    check($name . ' (does not contain ' . $needle . ')', strpos($haystack, $needle) === false, true);
}

function finish()
{
    echo "{$GLOBALS['tsm_passes']} passed, {$GLOBALS['tsm_failures']} failed\n";
    exit($GLOBALS['tsm_failures'] > 0 ? 1 : 0);
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/php/field-test.php`:

```php
<?php

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/../../class-ThreesidesTrackingSignals.php';
require __DIR__ . '/../../class-ThreesidesTrackingField.php';

function make_field($overrides = array())
{
    return new ThreesidesTrackingField(array_merge(array(
        'id'     => 5,
        'inputs' => ThreesidesTrackingField::default_inputs(5),
    ), $overrides));
}

$form = array('id' => 2);

// # Registration and registry --------------------------------------------------------------------

check('field registers', isset(GF_Fields::$registered['threesides_tracking_field']), true);
check('registry finds by suffix', ThreesidesTrackingSignals::find_by_input('3')['key'], 'gclid');
check('registry unknown suffix', ThreesidesTrackingSignals::find_by_input(10), null);
check('url limit', ThreesidesTrackingSignals::max_length('landing_page'), 500);
check('value limit', ThreesidesTrackingSignals::max_length('gclid'), 255);

// # Inputs ---------------------------------------------------------------------------------------

$inputs = ThreesidesTrackingField::default_inputs(5);
check('one input per signal', count($inputs), count(ThreesidesTrackingSignals::all()));
check('input id format', $inputs[2]['id'], '5.3');
check('falls back to defaults when inputs missing', count(make_field(array('inputs' => null))->get_entry_inputs()), 21);

// # Front-end markup -----------------------------------------------------------------------------

$hidden_inputs = ThreesidesTrackingField::default_inputs(5);
$hidden_inputs[1]['isHidden'] = true; // GA4 Session ID
$field = make_field(array('inputs' => $hidden_inputs));
$html  = $field->get_field_input($form, array('5.3' => "G'1<x>"));

check_contains('frontend input name', $html, "name='input_5.3'");
check_contains('frontend input id', $html, "id='input_2_5_3'");
check_contains('frontend data attribute', $html, "data-tsm-signal='gclid'");
check_contains('frontend escapes value', $html, "value='G&#039;1&lt;x&gt;'");
check_not_contains('frontend skips hidden inputs', $html, "data-tsm-signal='ga_session_id'");
check_not_contains('frontend has no labels', $html, '<label');
check('frontend content is the bare field', $field->get_field_content('', false, $form), '{FIELD}');

// # Entry edit (admin) --------------------------------------------------------------------------

$edit_field = make_field(array('test_context' => 'entry_detail'));
$edit       = $edit_field->get_field_input($form, array('5.3' => 'G1'));
check_contains('entry edit keeps values so updates do not wipe them', $edit, "id='input_5_3' value='G1'");
check('entry edit uses parent chrome', $edit_field->get_field_content('', false, $form), 'PARENT_CONTENT');

// # Editor markup --------------------------------------------------------------------------------

$field->test_context = 'editor';
$editor = $field->get_field_input($form, '');
check_contains('editor label for core toggle UI', $editor, "<label for='input_5_3'>GCLID</label>");
check_contains('editor container id', $editor, "id='input_5_3_container'");
check_contains('editor shows hidden inputs collapsed', $editor, "id='input_5_2_container' style='display:none;'");
check('editor content uses parent chrome', $field->get_field_content('', false, $form), 'PARENT_CONTENT');

$script = $field->get_form_editor_inline_script_on_page_render();
check_contains('editor defaults function', $script, 'function SetDefaultValues_threesides_tracking_field(field)');
check_contains('editor defaults include signals', $script, '{"input":23,"label":"Touch Timestamp"}');
check_contains('editor binds settings', $script, 'GetCustomizeInputsUI(field)');

ob_start();
ThreesidesTrackingField::render_signals_setting(1100);
$setting = ob_get_clean();
check_contains('setting markup', $setting, 'class="custom_inputs_setting gfield_sub_setting"');
ob_start();
ThreesidesTrackingField::render_signals_setting(1050);
check('setting only at its position', ob_get_clean(), '');

// # Saving ---------------------------------------------------------------------------------------

$field = make_field();
check('save strips tags', $field->get_value_save_input(" <b>Cj0</b> abc ", $form, 'input_5_3', 1, array()), 'Cj0 abc');
check('save keeps case', $field->get_value_save_input('IwAR0AbC', $form, 'input_5_8', 1, array()), 'IwAR0AbC');
check('save truncates values', strlen($field->get_value_save_input(str_repeat('a', 300), $form, 'input_5_3', 1, array())), 255);
check('save cleans urls', $field->get_value_save_input('javascript:alert(1)', $form, 'input_5_21', 1, array()), '');
check('save keeps urls', $field->get_value_save_input('https://example.com/?a=1', $form, 'input_5_21', 1, array()), 'https://example.com/?a=1');
check('save truncates urls', strlen($field->get_value_save_input('https://example.com/' . str_repeat('a', 600), $form, 'input_5_21', 1, array())), 500);
check('save rejects arrays', $field->get_value_save_input(array('x'), $form, 'input_5_3', 1, array()), '');
check('save handles empty', $field->get_value_save_input('', $form, 'input_5_3', 1, array()), '');
check('save unknown input still sanitised', $field->get_value_save_input('<i>x</i>', $form, 'input_5', 1, array()), 'x');
check('legacy save path matches', $field->get_value_save_entry(' <b>a</b> ', $form, 'input_5_3', 1, array()), 'a');

// # Display --------------------------------------------------------------------------------------

$custom = ThreesidesTrackingField::default_inputs(5);
$custom[2]['customLabel'] = 'Google Click';
$field = make_field(array('inputs' => $custom));
$value = array('5.1' => '111.222', '5.3' => 'G<1>', '5.14' => '');

$detail = $field->get_value_entry_detail($value);
check_contains('detail uses custom sub-label', $detail, '>Google Click</th>');
check_contains('detail escapes', $detail, '<td>G&lt;1&gt;</td>');
check_not_contains('detail skips empty', $detail, 'utm_source');
check('detail text format', $field->get_value_entry_detail($value, array(), false, 'text'), "GA4 Client ID: 111.222\nGoogle Click: G<1>");
check('detail empty', $field->get_value_entry_detail(array('5.1' => '')), '');
check('detail string falls back to parent', $field->get_value_entry_detail('x'), 'PARENT:x');

check('merge tag html', $field->get_value_merge_tag($value, '5', array(), $form, '', $value, false, true, 'html', false), 'GA4 Client ID: 111.222<br />Google Click: G&lt;1&gt;');
check('merge tag text', $field->get_value_merge_tag($value, '5', array(), $form, '', $value, false, false, 'text', false), "GA4 Client ID: 111.222\nGoogle Click: G<1>");
check('merge tag url', $field->get_value_merge_tag($value, '5', array(), $form, '', $value, true, false, 'url', false), 'GA4%20Client%20ID%3A%20111.222%0AGoogle%20Click%3A%20G%3C1%3E');
check('merge tag sub-input uses parent', $field->get_value_merge_tag('G1', '5.3', array(), $form, '', 'G1', false, false, 'text', false), 'PARENT:G1');

$entry = array('5.1' => '111.222', '5.3' => 'G1');
check('export whole field', $field->get_value_export($entry), 'GA4 Client ID: 111.222; Google Click: G1');
check('export whole field by id', $field->get_value_export($entry, '5'), 'GA4 Client ID: 111.222; Google Click: G1');
check('export sub-input', $field->get_value_export($entry, '5.3'), 'G1');

check('entry list count', $field->get_value_entry_list($value, array(), 5, array(), $form), '2 signals');
check('entry list singular', $field->get_value_entry_list(array('5.1' => 'x'), array(), 5, array(), $form), '1 signal');
check('entry list sub-input uses parent', $field->get_value_entry_list('G1', array(), '5.3', array(), $form), 'PARENT:G1');

finish();
```

- [ ] **Step 3: Run it to verify it fails**

Run: `php tests/php/field-test.php`
Expected: FAIL, `Failed opening required '.../class-ThreesidesTrackingField.php'`.

- [ ] **Step 4: Write the field**

Create `class-ThreesidesTrackingField.php`:

```php
<?php

/** Tracking Signals Field: one hidden sub-input per tracking signal, filled by app.js. */

if (! class_exists('GFForms')) {
    die();
}

class ThreesidesTrackingField extends GF_Field
{

    /**
     * @var string $type The field type.
     */
    public $type = 'threesides_tracking_field';

    /**
     * Return the field title, for use in the form editor.
     *
     * @return string
     */
    public function get_form_editor_field_title()
    {
        return esc_attr__('Tracking Signals', 'threesides-gf-tracking-connector');
    }

    /**
     * Return the field description, for use in the form editor.
     *
     * @return string
     */
    public function get_form_editor_field_description()
    {
        return esc_attr__('Collects analytics IDs, ad click IDs and UTMs for offline conversion tracking.', 'threesides-gf-tracking-connector');
    }

    /**
     * Adds the field button to the specified group.
     *
     * @param array $field_groups The field groups containing the individual field buttons.
     *
     * @return array
     */
    public function add_button($field_groups)
    {
        $field_groups = self::maybe_add_field_group($field_groups);

        return parent::add_button($field_groups);
    }

    /**
     * Adds the custom field group if it doesn't already exist.
     *
     * @param array $field_groups The field groups containing the individual field buttons.
     *
     * @return array
     */
    public static function maybe_add_field_group($field_groups)
    {
        foreach ($field_groups as $field_group) {
            if ($field_group['name'] == 'threesides_gf_tracking_connector') {
                return $field_groups;
            }
        }

        $field_groups[] = array(
            'name'   => 'threesides_gf_tracking_connector',
            'label'  => __('Analytics and Tracking', 'threesides-gf-tracking-connector'),
            'fields' => array()
        );

        return $field_groups;
    }

    /**
     * Assign the field button to the custom group.
     *
     * @return array
     */
    public function get_form_editor_button()
    {
        return array(
            'group' => 'threesides_gf_tracking_connector',
            'text'  => $this->get_form_editor_field_title(),
        );
    }

    /**
     * The settings which should be available on the field in the form editor.
     *
     * @return array
     */
    function get_form_editor_field_settings()
    {
        return array(
            'label_setting',
            'admin_label_setting',
            'css_class_setting',
            'threesides_tracking_signals_setting',
        );
    }

    /**
     * Tracking values are not user input, so conditional logic on them is not offered.
     *
     * @return bool
     */
    public function is_conditional_logic_supported()
    {
        return false;
    }

    /**
     * The field's sub-inputs. Falls back to every signal if the form has none stored.
     *
     * @return array
     */
    public function get_entry_inputs()
    {
        return is_array($this->inputs) && ! empty($this->inputs) ? $this->inputs : self::default_inputs($this->id);
    }

    /**
     * @param int $field_id The field ID.
     *
     * @return array One input per registered signal.
     */
    public static function default_inputs($field_id)
    {
        $inputs = array();
        foreach (ThreesidesTrackingSignals::all() as $signal) {
            $inputs[] = array(
                'id'    => $field_id . '.' . $signal['input'],
                'label' => $signal['label'],
                'name'  => '',
            );
        }

        return $inputs;
    }

    /**
     * @param string $input_id A sub-input ID such as "5.3".
     *
     * @return int The suffix after the dot, or 0.
     */
    private static function input_suffix($input_id)
    {
        $parts = explode('.', (string) $input_id);

        return isset($parts[1]) ? absint($parts[1]) : 0;
    }

    /**
     * @param array $input A sub-input.
     *
     * @return string The admin's custom sub-label if set, otherwise the default label.
     */
    private static function input_label($input)
    {
        return rgar($input, 'customLabel') ? $input['customLabel'] : rgar($input, 'label');
    }

    /**
     * Sets default sub-inputs for new fields and renders the show/hide toggles using the same
     * core UI as the Name and Address fields.
     *
     * @return string
     */
    public function get_form_editor_inline_script_on_page_render()
    {
        $signals = array();
        foreach (ThreesidesTrackingSignals::all() as $signal) {
            $signals[] = array('input' => $signal['input'], 'label' => $signal['label']);
        }

        $script = sprintf(
            'function SetDefaultValues_threesides_tracking_field(field) {' .
                'field.label = %s;' .
                'field.inputs = %s.map(function (signal) { return new Input(field.id + "." + signal.input, signal.label); });' .
            '}',
            wp_json_encode($this->get_form_editor_field_title()),
            wp_json_encode($signals)
        ) . PHP_EOL;

        $script .= 'jQuery(document).on("gform_load_field_settings", function (event, field) {' .
                'if (field.type === "threesides_tracking_field") {' .
                    'jQuery("#threesides_tracking_signals_container").html(GetCustomizeInputsUI(field));' .
                '}' .
            '});' . PHP_EOL;

        return $script;
    }

    /**
     * Renders the "Signals to collect" setting container. Hooked to gform_field_standard_settings.
     *
     * The wrapper must carry the custom_inputs_setting class: core binds its show/hide toggle
     * handler to that class when the editor loads.
     *
     * @param int $position The settings position being rendered.
     */
    public static function render_signals_setting($position)
    {
        if ($position != 1100) {
            return;
        }
        ?>
        <li class="threesides_tracking_signals_setting field_setting">
            <div class="custom_inputs_setting gfield_sub_setting">
                <span class="section_label"><?php esc_html_e('Signals to collect', 'threesides-gf-tracking-connector'); ?></span>
                <div id="threesides_tracking_signals_container"></div>
            </div>
        </li>
        <?php
    }

    /**
     * Front end: inputs only, no label or wrapper markup. Admin: the standard field chrome.
     *
     * @param string|array $value                The field value.
     * @param bool         $force_frontend_label Whether to force the frontend label.
     * @param array        $form                 The Form Object currently being processed.
     *
     * @return string
     */
    public function get_field_content($value, $force_frontend_label, $form)
    {
        if ($this->is_form_editor() || $this->is_entry_detail()) {
            return parent::get_field_content($value, $force_frontend_label, $form);
        }

        return '{FIELD}';
    }

    /**
     * Define the fields inner markup.
     *
     * @param array $form The Form Object currently being processed.
     * @param string|array $value The field value. From default/dynamic population, $_POST, or a resumed incomplete submission.
     * @param null|array $entry Null or the Entry Object currently being edited.
     *
     * @return string
     */
    public function get_field_input($form, $value = '', $entry = null)
    {
        $form_id        = absint(rgar($form, 'id'));
        $field_id       = absint($this->id);
        $is_form_editor = $this->is_form_editor();
        $use_short_id   = $is_form_editor || $this->is_entry_detail() || $form_id == 0;
        $values         = is_array($value) ? $value : array();
        $markup         = '';

        foreach ($this->get_entry_inputs() as $input) {
            $suffix = self::input_suffix($input['id']);
            $signal = ThreesidesTrackingSignals::find_by_input($suffix);
            if (! $signal) {
                continue;
            }

            $html_id   = $use_short_id ? "input_{$field_id}_{$suffix}" : "input_{$form_id}_{$field_id}_{$suffix}";
            $is_hidden = ! empty($input['isHidden']);

            if ($is_form_editor) {
                // GetCustomizeInputsUI() skips inputs without a matching label[for], and toggles #<id>_container.
                $markup .= sprintf(
                    "<li id='%1\$s_container'%2\$s><label for='%1\$s'>%3\$s</label><input type='hidden' id='%1\$s' disabled='disabled' /></li>",
                    esc_attr($html_id),
                    $is_hidden ? " style='display:none;'" : '',
                    esc_html(self::input_label($input))
                );
                continue;
            }

            if ($is_hidden) {
                continue;
            }

            $markup .= sprintf(
                "<input type='hidden' name='input_%d.%d' id='%s' value='%s' data-tsm-signal='%s' />",
                $field_id,
                $suffix,
                esc_attr($html_id),
                esc_attr(rgar($values, (string) $input['id'])),
                esc_attr($signal['key'])
            );
        }

        if ($is_form_editor) {
            $markup = sprintf(
                "<p>%s</p><ul class='threesides-tracking-signals'>%s</ul>",
                esc_html__('These signals will be collected:', 'threesides-gf-tracking-connector'),
                $markup
            );
        }

        return sprintf("<div class='ginput_container ginput_container_%s'>%s</div>", $this->type, $markup);
    }

    /**
     * Sanitize a sub-input value before saving (Gravity Forms 3.0+).
     *
     * @return string
     */
    public function get_value_save_input($value, $form, $input_name, $entry_id, $entry, $repeater_index = '')
    {
        return $this->sanitize_signal_value($value, $input_name);
    }

    /**
     * Sanitize a sub-input value before saving (Gravity Forms 2.9; deprecated in 3.0).
     *
     * @return string
     */
    public function get_value_save_entry($value, $form, $input_name, $lead_id, $lead)
    {
        return $this->sanitize_signal_value($value, $input_name);
    }

    /**
     * @param mixed  $value      The submitted value.
     * @param string $input_name The POST name, e.g. "input_5_3".
     *
     * @return string
     */
    private function sanitize_signal_value($value, $input_name)
    {
        if (is_array($value) || rgblank($value)) {
            return '';
        }

        $signal = preg_match('/^input_\d+_(\d+)$/', (string) $input_name, $match) ? ThreesidesTrackingSignals::find_by_input($match[1]) : null;
        $key    = $signal ? $signal['key'] : '';
        $value  = ThreesidesTrackingSignals::is_url($key) ? esc_url_raw($value) : sanitize_text_field($value);

        return mb_substr($value, 0, ThreesidesTrackingSignals::max_length($key));
    }

    /**
     * @param array $values Values keyed by sub-input ID (a field value or an entry).
     *
     * @return array[] [label, value] pairs for every non-empty sub-input.
     */
    private function signal_rows($values)
    {
        $rows = array();
        foreach ($this->get_entry_inputs() as $input) {
            $input_value = rgar($values, (string) $input['id']);
            if (! rgblank($input_value)) {
                $rows[] = array(self::input_label($input), $input_value);
            }
        }

        return $rows;
    }

    /**
     * @param array[] $rows [label, value] pairs.
     *
     * @return string[] "Label: value" lines.
     */
    private static function rows_as_lines($rows)
    {
        $lines = array();
        foreach ($rows as $row) {
            $lines[] = $row[0] . ': ' . $row[1];
        }

        return $lines;
    }

    /**
     * Entry detail and {all_fields}: a table of the collected signals.
     *
     * @return string
     */
    public function get_value_entry_detail($value, $entry = array(), $use_text = false, $format = 'html', $media = 'screen')
    {
        if (! is_array($value)) {
            return parent::get_value_entry_detail($value, $entry, $use_text, $format, $media);
        }

        $rows = $this->signal_rows($value);
        if (empty($rows)) {
            return '';
        }

        if ($format === 'text') {
            return implode("\n", self::rows_as_lines($rows));
        }

        $html = '';
        foreach ($rows as $row) {
            $html .= sprintf(
                "<tr><th scope='row' style='text-align:left;padding-right:1em;'>%s</th><td>%s</td></tr>",
                esc_html($row[0]),
                esc_html($row[1])
            );
        }

        return "<table class='threesides-tracking-signals-table'><tbody>{$html}</tbody></table>";
    }

    /**
     * Whole-field merge tag: "Label: value" lines. Sub-input merge tags use the core behaviour.
     *
     * @return string
     */
    public function get_value_merge_tag($value, $input_id, $entry, $form, $modifier, $raw_value, $url_encode, $esc_html, $format, $nl2br)
    {
        if (! is_array($value)) {
            return parent::get_value_merge_tag($value, $input_id, $entry, $form, $modifier, $raw_value, $url_encode, $esc_html, $format, $nl2br);
        }

        $lines = self::rows_as_lines($this->signal_rows(is_array($raw_value) ? $raw_value : $value));
        foreach ($lines as &$line) {
            if ($url_encode) {
                $line = rawurlencode($line);
            } elseif ($esc_html || $format === 'html') {
                $line = esc_html($line);
            }
        }
        unset($line);

        if ($url_encode) {
            return implode('%0A', $lines);
        }

        return implode($format === 'html' ? '<br />' : "\n", $lines);
    }

    /**
     * Whole-field export: "Label: value" pairs joined by "; ". Sub-inputs export as-is.
     *
     * @return string
     */
    public function get_value_export($entry, $input_id = '', $use_text = false, $is_csv = false)
    {
        if (empty($input_id) || strpos((string) $input_id, '.') === false) {
            return implode('; ', self::rows_as_lines($this->signal_rows($entry)));
        }

        return parent::get_value_export($entry, $input_id, $use_text, $is_csv);
    }

    /**
     * Entry list: a count for the whole-field column; sub-input columns use the core behaviour.
     *
     * @return string
     */
    public function get_value_entry_list($value, $entry, $field_id, $columns, $form)
    {
        if (! is_array($value)) {
            return parent::get_value_entry_list($value, $entry, $field_id, $columns, $form);
        }

        $count = count($this->signal_rows($value));

        /* translators: %d: number of tracking signals collected. */
        return esc_html(sprintf(_n('%d signal', '%d signals', $count, 'threesides-gf-tracking-connector'), $count));
    }
}

GF_Fields::register(new ThreesidesTrackingField());
```

- [ ] **Step 5: Run it to verify it passes**

Run: `php -l class-ThreesidesTrackingField.php && php tests/php/field-test.php`
Expected: `No syntax errors detected`, then `52 passed, 0 failed`.

- [ ] **Step 6: Add the PHP tests to `npm test`**

In `package.json`, change the `test` script to:

```json
    "test": "node --test && php tests/php/field-test.php"
```

Run: `npm test`
Expected: `ℹ pass 63`, `ℹ fail 0`, then `52 passed, 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add class-ThreesidesTrackingField.php tests/php/bootstrap.php tests/php/field-test.php package.json
git commit -m "Add Tracking Signals multi-input field

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Retire the legacy fields from the editor

**Files:**
- Move: the four `class-Threesides*TrackingField.php` legacy files into `legacy/`
- Modify: each `legacy/*.php` (`add_button()` and text domain)
- Modify: `class-ThreesidesGravityFormsTrackingConnector.php:43-46` (require paths)
- Modify: `tests/php/bootstrap.php` (add a `GF_Field_Hidden` stand-in)
- Create: `tests/php/legacy-test.php`
- Modify: `package.json` (`test` script)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - The legacy classes stay registered under their original type strings, and `add_button()` returns `$field_groups` unchanged.
  - The legacy markup (`.ginput_container_<type> input[type=hidden]`) is untouched, so Task 3's `LEGACY_SELECTORS` keep working.

- [ ] **Step 1: Add the `GF_Field_Hidden` stand-in**

In `tests/php/bootstrap.php`, insert immediately after the closing `}` of `class GF_Field`:

```php

class GF_Field_Hidden extends GF_Field
{
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/php/legacy-test.php`:

```php
<?php

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/../../legacy/class-ThreesidesGa4ClientIdTrackingField.php';
require __DIR__ . '/../../legacy/class-ThreesidesFbclidTrackingField.php';
require __DIR__ . '/../../legacy/class-ThreesidesUtmsTrackingField.php';
require __DIR__ . '/../../legacy/class-ThreesidesGclidTrackingField.php';

$groups = array(array('name' => 'standard_fields', 'label' => 'Standard', 'fields' => array()));

foreach (array(
    'threesides_ga4_client_id_tracking_field',
    'threesides_fbclid_tracking_field',
    'threesides_utms_tracking_field',
    'threesides_gclid_tracking_field',
) as $type) {
    check("{$type} stays registered", isset(GF_Fields::$registered[$type]), true);
    check("{$type} has no editor button", GF_Fields::$registered[$type]->add_button($groups), $groups);
}

finish();
```

- [ ] **Step 3: Run it to verify it fails**

Run: `php tests/php/legacy-test.php`
Expected: FAIL, `Failed opening required '.../legacy/class-ThreesidesGa4ClientIdTrackingField.php'`.

- [ ] **Step 4: Move the files**

```bash
mkdir legacy
git mv class-ThreesidesGa4ClientIdTrackingField.php legacy/
git mv class-ThreesidesFbclidTrackingField.php legacy/
git mv class-ThreesidesUtmsTrackingField.php legacy/
git mv class-ThreesidesGclidTrackingField.php legacy/
```

- [ ] **Step 5: Run it to verify the button test fails**

Run: `php tests/php/legacy-test.php`
Expected: FAIL, 4 failures named `... has no editor button`. The old `add_button()` calls `maybe_add_field_group()`, which appends the "Analytics and Tracking" group.

- [ ] **Step 6: Remove the editor buttons**

In **each** of the four `legacy/*.php` files, replace this block:

```php
    /**
     * Adds the field button to the specified group.
     *
     * @param array $field_groups The field groups containing the individual field buttons.
     *
     * @return array
     */
    public function add_button($field_groups)
    {
        $field_groups = $this->maybe_add_field_group($field_groups);

        return parent::add_button($field_groups);
    }
```

with:

```php
    /**
     * No editor button: superseded by the Tracking Signals field. The type stays registered so
     * existing forms and entries keep working.
     *
     * @param array $field_groups The field groups containing the individual field buttons.
     *
     * @return array
     */
    public function add_button($field_groups)
    {
        return $field_groups;
    }
```

- [ ] **Step 7: Unify the text domain**

In `legacy/class-ThreesidesGa4ClientIdTrackingField.php` and `legacy/class-ThreesidesGclidTrackingField.php`, line 24, replace `'threesides-ga4-gravityforms'` with `'threesides-gf-tracking-connector'`.

Run: `git grep -n "threesides-ga4-gravityforms'" -- '*.php'`
Expected: one match only, the `$_path` line in `class-ThreesidesGravityFormsTrackingConnector.php`. That's the plugin folder name, not a text domain, so leave it.

- [ ] **Step 8: Point the add-on at the new paths**

In `class-ThreesidesGravityFormsTrackingConnector.php`, replace:

```php
            require_once('class-ThreesidesGa4ClientIdTrackingField.php');
            require_once('class-ThreesidesFbclidTrackingField.php');
            require_once('class-ThreesidesUtmsTrackingField.php');
            require_once('class-ThreesidesGclidTrackingField.php');
```

with:

```php
            require_once(__DIR__ . '/legacy/class-ThreesidesGa4ClientIdTrackingField.php');
            require_once(__DIR__ . '/legacy/class-ThreesidesFbclidTrackingField.php');
            require_once(__DIR__ . '/legacy/class-ThreesidesUtmsTrackingField.php');
            require_once(__DIR__ . '/legacy/class-ThreesidesGclidTrackingField.php');
```

- [ ] **Step 9: Run everything**

Run: `for f in legacy/*.php class-ThreesidesGravityFormsTrackingConnector.php; do php -l "$f"; done`
Expected: `No syntax errors detected` for all 5 files.

In `package.json`, change the `test` script to:

```json
    "test": "node --test && php tests/php/field-test.php && php tests/php/legacy-test.php"
```

Run: `npm test`
Expected: `ℹ pass 63`, then `52 passed, 0 failed`, then `8 passed, 0 failed`.

- [ ] **Step 10: Commit**

```bash
git add -A legacy class-ThreesidesGravityFormsTrackingConnector.php tests/php package.json
git commit -m "Move legacy tracking fields to legacy/ and hide their editor buttons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Add-on wiring, editor styles and version

**Files:**
- Replace: `class-ThreesidesGravityFormsTrackingConnector.php` (the whole file)
- Replace: `app.css` (the whole file)
- Modify: `threesides-gf-tracking-connector.php:7` and `:14` (version)

**Interfaces:**
- Consumes:
  - From Task 4: `class-ThreesidesTrackingSignals.php`.
  - From Task 5: `ThreesidesTrackingField::render_signals_setting`, the type `threesides_tracking_field`, and the editor classes `.threesides-tracking-signals`.
  - From Task 6: the `legacy/` paths.
- Produces the finished plugin:
  - `app.js` loads on every front-end page with no jQuery dependency.
  - `app.css` loads only in the form editor.
  - The front-end wrapper of a Tracking Signals field gets the `gform_hidden` class.

Why each change:
- **The `scripts()` override goes.** Its field-type enqueue rule duplicated the site-wide enqueue, and capture has to run on landing pages that have no form.
- **`styles()` targets `admin_page => form_editor`.** The old front-end field-type rule meant the editor styling never loaded in the editor.
- **The CSS-class filter is registered in `init()`, not `init_frontend()`,** because forms re-rendered over AJAX go through `admin-ajax.php`, where only the admin init runs.
- **`$_path` stays as it is.** `GFAddOn::update_path()` already corrects a mismatched folder name.

- [ ] **Step 1: Replace the add-on class**

Replace the entire contents of `class-ThreesidesGravityFormsTrackingConnector.php` with:

```php
<?php

GFForms::include_addon_framework();

class ThreesidesGravityFormsTrackingConnector extends GFAddOn
{

    protected $_version = Threesides_GravityForms_TrackingConnector_Version;
    protected $_min_gravityforms_version = '2.9';
    protected $_slug = 'threesides-gf-tracking-connector';
    protected $_path = 'threesides-ga4-gravityforms/threesides-gf-tracking-connector.php';
    protected $_full_path = __FILE__;
    protected $_title = 'Threesides Gravity Forms Tracking Connector';
    protected $_short_title = 'Tracking Connector';

    /**
     * @var object $_instance If available, contains an instance of this class.
     */
    private static $_instance = null;

    /**
     * Returns an instance of this class, and stores it in the $_instance property.
     *
     * @return object $_instance An instance of this class.
     */
    public static function get_instance()
    {
        if (self::$_instance == null) {
            self::$_instance = new self();
        }

        return self::$_instance;
    }

    /**
     * Include the fields early so they are available when entry exports are being performed.
     */
    public function pre_init()
    {
        parent::pre_init();

        if ($this->is_gravityforms_supported() && class_exists('GF_Field')) {
            require_once(__DIR__ . '/class-ThreesidesTrackingSignals.php');
            require_once(__DIR__ . '/class-ThreesidesTrackingField.php');

            // Superseded by the Tracking Signals field; kept registered so existing forms and entries keep working.
            require_once(__DIR__ . '/legacy/class-ThreesidesGa4ClientIdTrackingField.php');
            require_once(__DIR__ . '/legacy/class-ThreesidesFbclidTrackingField.php');
            require_once(__DIR__ . '/legacy/class-ThreesidesUtmsTrackingField.php');
            require_once(__DIR__ . '/legacy/class-ThreesidesGclidTrackingField.php');
        }
    }

    public function init()
    {
        parent::init();

        // Registered here (not init_frontend) so AJAX-rendered forms are covered too.
        add_filter('gform_field_css_class', array($this, 'hide_tracking_field_wrapper'), 10, 2);
    }

    public function init_admin()
    {
        parent::init_admin();

        add_action('gform_field_standard_settings', array('ThreesidesTrackingField', 'render_signals_setting'));
    }

    public function init_frontend()
    {
        parent::init_frontend();

        add_action('wp_enqueue_scripts', array($this, 'enqueue_capture_script'));
    }

    /**
     * app.js runs on every front-end page: click IDs and UTMs arrive on landing pages that often
     * have no form, so capture cannot wait for a page with a tracking field.
     */
    public function enqueue_capture_script()
    {
        wp_enqueue_script('threesides-gravity-forms-tracking', $this->get_base_url() . '/app.js', array(), $this->_version, true);
    }

    /**
     * Gives the Tracking Signals field wrapper the core gform_hidden class on the front end, so it
     * takes no space in the form layout.
     *
     * @param string   $classes The field wrapper CSS classes.
     * @param GF_Field $field   The field being rendered.
     *
     * @return string
     */
    public function hide_tracking_field_wrapper($classes, $field)
    {
        if ($field->type !== 'threesides_tracking_field' || GFCommon::is_form_editor()) {
            return $classes;
        }

        return trim($classes . ' gform_hidden');
    }


    // # SCRIPTS & STYLES -----------------------------------------------------------------------------------------------

    /**
     * Form editor styles for the tracking fields' previews.
     *
     * @return array
     */
    public function styles()
    {
        $styles = array(
            array(
                'handle'  => 'threesides-gravity-forms-tracking',
                'src'     => $this->get_base_url() . '/app.css',
                'version' => $this->_version,
                'enqueue' => array(
                    array('admin_page' => array('form_editor')),
                )
            )
        );

        return array_merge(parent::styles(), $styles);
    }
}
```

- [ ] **Step 2: Replace `app.css`**

Replace the entire contents of `app.css` with:

```css
/**
 * Form editor styles for the tracking fields' previews.
 */

.gfield--type-threesides_tracking_field,
.gfield--type-threesides_ga4_client_id_tracking_field,
.gfield--type-threesides_fbclid_tracking_field,
.gfield--type-threesides_utms_tracking_field,
.gfield--type-threesides_gclid_tracking_field {
  .gfield-admin-wrapper {
    border: 1px dashed;
    padding: 1rem;
    border-radius: 3px;
    background: #f5f5f5;
    opacity: 0.6;
  }
}

.threesides-tracking-signals {
  columns: 2;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.85em;
}

.threesides-tracking-signals label {
  font-weight: normal;
}
```

- [ ] **Step 3: Bump the version**

In `threesides-gf-tracking-connector.php`, change line 7 to:

```php
 * Version: 0.2.0
```

and line 14 to:

```php
define('Threesides_GravityForms_TrackingConnector_Version', '0.2.0');
```

- [ ] **Step 4: Verify**

Run: `for f in *.php legacy/*.php; do php -l "$f"; done`
Expected: `No syntax errors detected` for all 8 files.

Run: `npm test`
Expected: `ℹ pass 63`, then `52 passed, 0 failed`, then `8 passed, 0 failed`.

Run: `git grep -n "gform_field_css_class\|render_signals_setting\|wp_enqueue_script\|'admin_page'" -- class-ThreesidesGravityFormsTrackingConnector.php`
Expected: four matches:
- the `add_filter('gform_field_css_class', …)` line inside `init()`
- the `render_signals_setting` hook inside `init_admin()`
- `wp_enqueue_script(…, array(), …)` (no jQuery dependency)
- `array('admin_page' => array('form_editor'))`

- [ ] **Step 5: Smoke test in WordPress**

Upload the plugin to the test site, then:
- Confirm that opening any form in the editor shows **Tracking Signals** in "Analytics and Tracking", and that adding it lists 21 signals with toggles under **Signals to collect**.
- Confirm that a front-end page without a form loads `app.js` (check the Network tab).

If the toggles don't render, core's `GetCustomizeInputsUI` didn't find the inputs. Check that the editor preview contains `label[for="input_<id>_3"]`. Report it as a blocker rather than working around it.

- [ ] **Step 6: Commit**

```bash
git add class-ThreesidesGravityFormsTrackingConnector.php app.css threesides-gf-tracking-connector.php
git commit -m "Wire Tracking Signals field into the add-on; load capture script site-wide

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Documentation and manual test checklist

**Files:**
- Replace: `readme.md` (the whole file)
- Create: `docs/manual-testing.md`
- Modify: `docs/superpowers/specs/2026-10-13-unified-tracking-field-design.md:4` (status)

**Interfaces:**
- Consumes: the behaviour of Tasks 1–7.
- Produces: user-facing docs, plus the checklist the user runs on a real WordPress site. The checklist covers Review Focus item 5.

- [ ] **Step 1: Replace `readme.md`**

Replace the entire contents of `readme.md` with:

```markdown
# Threesides Gravity Forms Tracking Connector

Plugin for Gravity Forms that collects tracking data with each form entry, for offline and enhanced
conversion uploads (Google Ads, Meta Conversions API, GA4 Measurement Protocol, Microsoft Ads,
LinkedIn and TikTok).

Requires Gravity Forms 2.9 or later.

## Installation

1. Click the `<> Code` button, then `Download ZIP`
2. Upload the plugin to your WordPress installation via the Add Plugin page.
3. Activate the plugin.
4. Edit your form and add the **Tracking Signals** field (from the Analytics and Tracking section).
5. Optionally untick any signals you don't need under **Signals to collect**. All are on by default.
6. Map the sub-fields you need in your feeds (HubSpot, Webhooks, Zapier, etc.) or exports.

## Signals

| Signal | Source |
|---|---|
| GA4 Client ID | `_ga` cookie |
| GA4 Session ID | `_ga_<MEASUREMENT_ID>` cookie |
| GCLID | `gclid` URL parameter, falling back to Google's `_gcl_aw` cookie |
| GBRAID, WBRAID | `gbraid` / `wbraid` URL parameters |
| gad_source, gad_campaignid | URL parameters |
| Meta fbc | Meta's `_fbc` cookie, or built from the `fbclid` URL parameter |
| Meta fbp | Meta's `_fbp` cookie (only present when the Meta Pixel is installed) |
| Microsoft Click ID, LinkedIn li_fat_id, TikTok ttclid | `msclkid` / `li_fat_id` / `ttclid` URL parameters |
| utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id | URL parameters |
| Landing Page, Referrer, Touch Timestamp | The page, referrer and time of the visit that set the UTMs |

Gravity Forms already records the visitor's IP address, user agent and the form's page URL on every
entry, so those are not duplicated.

Each signal is its own sub-field, so it has its own export column, merge tag
(e.g. `{Tracking Signals (GCLID):5.3}`) and feed mapping. `{all_fields}` lists every collected
signal.

## How collection works

A small script runs on every page of the site. When a visitor arrives with click IDs or UTMs, it
stores them in a first-party cookie, `_tsm_attr`, for 90 days. Each ad platform's click ID is kept
separately, so a later Facebook visit doesn't erase an earlier Google click. UTMs, landing page and
referrer follow "last non-direct" attribution: they are replaced by the next visit that has UTMs, a
click ID or an external referrer, and left alone by direct visits.

When a form is shown or submitted, the script fills the Tracking Signals field from that cookie
and from the analytics cookies set by Google and Meta.

## Legacy fields

Versions before 0.2.0 had separate GA4 Client ID, GCLID, FBCLID and UTMs fields. They still work
on existing forms, but can no longer be added to new forms. Use Tracking Signals instead.

## Cookie Notice

The `_tsm_attr` cookie is set on any page a visitor lands on with click IDs or UTMs, and expires
90 days after the most recent such visit. It is not removed when a form is submitted, so repeat
enquiries keep their attribution. The plugin does not currently wait for cookie consent; disclose
this cookie in your privacy policy.

## Development

`npm test` runs the JavaScript tests (Node 18+) and the PHP field tests (PHP 7.4+ on your PATH).
No dependencies to install. See `docs/manual-testing.md` for the in-WordPress checklist.
```

- [ ] **Step 2: Create `docs/manual-testing.md`**

```markdown
# Manual Testing Checklist

Run on a WordPress site with Gravity Forms 3.x (and once on 2.9 if you support it), with the plugin
active and page caching off for the first pass. Use a private window per scenario so cookies start
clean. Check cookies in DevTools → Application → Cookies.

Setup: a form ("Test") containing a Tracking Signals field plus a Name field, embedded on `/contact`.
Note the field's ID (shown in the editor); the steps below call it `N`.

## 1. Editor

- [ ] Analytics and Tracking group shows **Tracking Signals** and none of GA4 Client ID / GCLID /
      FBCLID / UTMs.
- [ ] Adding the field shows "These signals will be collected:" with all 21 signals listed.
- [ ] **Signals to collect** shows a toggle per signal. Turning one off hides it from the preview
      list immediately; saving and reloading the form keeps it off.
- [ ] A custom sub-label typed in that table appears in the preview after saving.

## 2. Capture on a page without a form

- [ ] Visit `/?gclid=TESTG&gbraid=TESTGB&fbclid=TestFb&utm_source=google&utm_medium=cpc&utm_campaign=brand`
      on a page that has **no** form.
- [ ] A `_tsm_attr` cookie exists, scoped to the root domain (e.g. `.example.com`), expiring in 90 days.

## 3. Submission

- [ ] Navigate internally to `/contact` and submit.
- [ ] Entry detail shows a table with GCLID `TESTG`, GBRAID `TESTGB`, Meta fbc `fb.1.<13 digits>.TestFb`
      (case preserved), utm_source/medium/campaign, Landing Page (the step 2 URL), Touch Timestamp,
      and GA4 Client ID / Meta fbp if those tags run on the site.
- [ ] Signals turned off in step 1 are absent from the entry and from the page source.
- [ ] Repeat with the form set to AJAX submission: same values saved (confirms our submit listener
      runs before Gravity Forms reads the form).
- [ ] On a fresh private window, land directly on `/contact?gclid=FIRSTHIT` and submit within a
      second or two: GA4 Client ID is still captured if GA4 is installed (filled at submit time).

## 4. Outputs

- [ ] Entries list: the field column shows "N signals"; individual sub-fields can be added as columns.
- [ ] Export entries: each signal is offered as its own column and exports its value.
- [ ] A notification using `{all_fields}` lists the collected signals; one using
      `{Tracking Signals (GCLID):N.3}` shows just the GCLID.
- [ ] A feed (e.g. Webhooks or HubSpot) lists each signal separately in its field mapping.
- [ ] Editing the entry in the admin and clicking Update keeps every signal value.

## 5. Attribution rules

- [ ] After step 3, visit `/about` directly (type the URL): `_tsm_attr` is unchanged.
- [ ] Visit `/?utm_source=newsletter`: submit again; utm_source is `newsletter`, utm_medium and
      utm_campaign are empty, and GCLID is still `TESTG`.
- [ ] Arrive from an external site (click a link to the site from another domain): the touch's
      referrer updates and UTMs are cleared; GCLID is still `TESTG`.

## 6. Multi-page and re-rendered forms

- [ ] Multi-page form (Tracking Signals on page 1): values survive to the final submission.
- [ ] Multi-page form with AJAX enabled: same.
- [ ] Save and Continue: resume from the emailed link and submit; the original values are kept.

## 7. Legacy fields

- [ ] An existing form with the old GA4 Client ID / GCLID / FBCLID / UTMs fields still populates
      them on submission (UTMs as `source|medium|campaign|content|term`, FBCLID as the raw fbclid).
- [ ] Old entries from before the upgrade still display their values.
- [ ] A visitor who had the old `_tsm_gclid` cookie keeps their GCLID after the upgrade.

## 8. Caching

- [ ] With page caching on (e.g. WP Engine), repeat steps 2–3: values are still captured
      (collection is fully client-side, so cached pages must still work).
```

- [ ] **Step 3: Mark the spec implemented**

In `docs/superpowers/specs/2026-10-13-unified-tracking-field-design.md`, change line 4 to:

```markdown
**Status:** Implemented (0.2.0) — pending manual testing per `docs/manual-testing.md`
```

- [ ] **Step 4: Final verification**

Run: `npm test`
Expected: `ℹ pass 63`, then `52 passed, 0 failed`, then `8 passed, 0 failed`.

Run: `git status --short`
Expected: only `readme.md`, `docs/manual-testing.md` and the spec are modified or new.

- [ ] **Step 5: Commit**

```bash
git add readme.md docs/manual-testing.md docs/superpowers/specs/2026-10-13-unified-tracking-field-design.md
git commit -m "Document Tracking Signals field and add manual test checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Hand over for manual testing**

Ask the user to run `docs/manual-testing.md` on their Gravity Forms 3.x site, and fix anything it turns up before merging `dev` to `main`.
