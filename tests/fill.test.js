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
