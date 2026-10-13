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
