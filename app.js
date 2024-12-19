function get_cookie(name) {
  var cookie = {};
  document.cookie.split(";").forEach(function (el) {
    var splitCookie = el.split("=");
    var key = splitCookie[0].trim();
    var value = splitCookie[1];
    cookie[key] = value;
  });
  return cookie[name];
}

/**
 * Add GA4 Client ID to the hidden field.
 */
addEventListener("DOMContentLoaded", function () {
  function get_ga_clientid() {
    if (get_cookie("_ga") === undefined) {
      return "";
    }
    return get_cookie("_ga").substring(6);
  }

  /**
   * Set the GA4 Client ID value to the hidden field.
   */
  const ga4_fields = document.querySelectorAll(
    ".ginput_container_threesides_ga4_client_id_tracking_field input[type=text]"
  );
  if (get_ga_clientid() !== "" && ga4_fields.length > 0) {
    for (let i = 0; i < ga4_fields.length; i++) {
      ga4_fields[i].value = get_ga_clientid();
    }
  }
});

/**
 * Check for GCLID url parameter, and store cookie if found to then add to form.
 */
addEventListener("DOMContentLoaded", function () {
  const gclid = new URL(window.location.href).searchParams.get("gclid");
  if (gclid) {
    document.cookie = `_tsm_gclid=${gclid}; path=/; domain=.${window.location.hostname}; max-age=31536000`;
  }

  /** Check for GCLID cookie, and add to form if found. */
  const gclid_cookie = get_cookie("_tsm_gclid");
  const gclid_field = document.querySelectorAll(
    ".ginput_container_threesides_gclid_tracking_field input[type=text]"
  );
  if (gclid_cookie && gclid_field.length > 0) {
    gclid_field[0].value = gclid_cookie;
  }
});

/**
 * Check for FBCLID url parameter, and store cookie if found to then add to form.
 */
addEventListener("DOMContentLoaded", function () {
  const fbclid = new URL(window.location.href).searchParams.get("fbclid");
  if (fbclid) {
    document.cookie = `_tsm_fbclid=${fbclid}; path=/; domain=.${window.location.hostname}; max-age=31536000`;
  }

  /** Check for FBCLID cookie, and add to form if found. */
  const fbclid_cookie = get_cookie("_tsm_fbclid");
  const fbclid_field = document.querySelectorAll(
    ".ginput_container_threesides_fbclid_tracking_field input[type=text]"
  );
  if (fbclid_cookie && fbclid_field.length > 0) {
    fbclid_field[0].value = fbclid_cookie;
  }
});

/**
 * Check for UTM parameters, and store cookie if found to then add to form.
 */
addEventListener("DOMContentLoaded", function () {
  const utm_source = new URL(window.location.href).searchParams.get(
    "utm_source"
  );
  const utm_medium = new URL(window.location.href).searchParams.get(
    "utm_medium"
  );
  const utm_campaign = new URL(window.location.href).searchParams.get(
    "utm_campaign"
  );
  const utm_content = new URL(window.location.href).searchParams.get(
    "utm_content"
  );
  const utm_term = new URL(window.location.href).searchParams.get("utm_term");
  if (utm_source || utm_medium || utm_campaign || utm_content || utm_term) {
    document.cookie = `_tsm_utm=${utm_source}|${utm_medium}|${utm_campaign}|${utm_content}|${utm_term}; path=/; domain=.${window.location.hostname}; max-age=31536000`;
  }

  /** Check for UTM cookie, and add to form if found. */
  const utm_cookie = get_cookie("_tsm_utm");
  const utm_field = document.querySelectorAll(
    ".ginput_container_threesides_utms_tracking_field input[type=text]"
  );
  if (utm_cookie && utm_field.length > 0) {
    utm_field[0].value = utm_cookie;
  }
});

/**
 *  Clear cookies once Gravity Form has been submitted.
 */
addEventListener("gform_confirmation_loaded", function () {
  document.cookie = `_tsm_gclid=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/; domain=.${window.location.hostname}`;
  document.cookie = `_tsm_fbclid=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/; domain=.${window.location.hostname}`;
  document.cookie = `_tsm_utm=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/; domain=.${window.location.hostname}`;
});
