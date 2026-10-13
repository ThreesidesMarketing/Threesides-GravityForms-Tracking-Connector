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
