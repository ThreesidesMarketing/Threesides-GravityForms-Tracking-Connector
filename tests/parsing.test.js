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
