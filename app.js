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
