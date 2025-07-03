function get_cookie(name) {
  const cookies = document.cookie.split(";").reduce((acc, el) => {
    const [key, value] = el.split("=").map((item) => item.trim());
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {});
  return cookies[name] || null; // Return null if the cookie is not found
}

function sanitize(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML; // Escapes any potentially harmful characters
}

/**
 *  Clear cookies once Gravity Form has been submitted.
 */
function clear_cookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/; domain=${window.location.hostname}`;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/; domain=.${window.location.hostname}`;
}

/**
 * Add GA4 Client ID to the hidden field.
 */
addEventListener("DOMContentLoaded", function () {
  // Handle GA4 Client ID
  const ga4_fields = document.querySelectorAll(
    ".ginput_container_threesides_ga4_client_id_tracking_field input[type=hidden]"
  );
  const ga_client_id = get_cookie("_ga") ? get_cookie("_ga").substring(6) : "";
  if (ga_client_id && ga4_fields.length > 0) {
    ga4_fields.forEach((field) => {
      field.value = ga_client_id;
    });
  }

  // Handle GCLID
  const gclid = sanitize(new URL(window.location.href).searchParams.get("gclid") || "");
  if (gclid) {
    document.cookie = `_tsm_gclid=${gclid}; path=/; domain=.${window.location.hostname}; max-age=31536000`;
  }
  const gclid_cookie = get_cookie("_tsm_gclid");
  const gclid_fields = document.querySelectorAll(
    ".ginput_container_threesides_gclid_tracking_field input[type=hidden]"
  );
  if (gclid_cookie && gclid_fields.length > 0) {
    gclid_fields.forEach((field) => {
      field.value = gclid_cookie;
    });
  }

  // Handle FBCLID
  const fbclid = sanitize(new URL(window.location.href).searchParams.get("fbclid") || "");
  if (fbclid) {
    document.cookie = `_tsm_fbclid=${fbclid}; path=/; domain=.${window.location.hostname}; max-age=31536000`;
  }
  const fbclid_cookie = get_cookie("_tsm_fbclid");
  const fbclid_fields = document.querySelectorAll(
    ".ginput_container_threesides_fbclid_tracking_field input[type=hidden]"
  );
  if (fbclid_cookie && fbclid_fields.length > 0) {
    fbclid_fields.forEach((field) => {
      field.value = fbclid_cookie;
    });
  }

  // Handle UTM Parameters
  const utm_source = sanitize(new URL(window.location.href).searchParams.get("utm_source") || "");
  const utm_medium = sanitize(new URL(window.location.href).searchParams.get("utm_medium") || "");
  const utm_campaign = sanitize(new URL(window.location.href).searchParams.get("utm_campaign") || "");
  const utm_content = sanitize(new URL(window.location.href).searchParams.get("utm_content") || "");
  const utm_term = sanitize(new URL(window.location.href).searchParams.get("utm_term") || "");
  if (utm_source || utm_medium || utm_campaign || utm_content || utm_term) {
    document.cookie = `_tsm_utm=${utm_source}|${utm_medium}|${utm_campaign}|${utm_content}|${utm_term}; path=/; domain=.${window.location.hostname}; max-age=31536000`;
  }
  const utm_cookie = get_cookie("_tsm_utm");
  const utm_fields = document.querySelectorAll(
    ".ginput_container_threesides_utms_tracking_field input[type=hidden]"
  );
  if (utm_cookie && utm_fields.length > 0) {
    utm_fields.forEach((field) => {
      field.value = utm_cookie;
    });
  }
});



addEventListener("gform_confirmation_loaded", function () {
  clear_cookie("_tsm_gclid");
  clear_cookie("_tsm_fbclid");
  clear_cookie("_tsm_utm");
});
