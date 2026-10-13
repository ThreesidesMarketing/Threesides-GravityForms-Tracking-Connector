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
