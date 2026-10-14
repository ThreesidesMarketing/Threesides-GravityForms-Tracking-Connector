# Unified Tracking Field — Design

**Date:** 2026-10-13
**Status:** Implemented (0.2.0) — manual testing passed 2026-10-14 (`docs/manual-testing.md`)
**Target version:** 0.2.0
**Target platform:** Gravity Forms 3.x (latest at time of writing: 3.1.3), PHP 7.4+

## Goal

Replace the four single-purpose hidden fields (GA4 Client ID, GCLID, FBCLID, UTMs) with one
Gravity Forms field that collects every supported tracking signal as its own sub-input. Admins
choose which signals a form collects; all are on by default. Each sub-input must be individually
exportable, merge-taggable and mappable in feed add-ons so the data can drive offline / enhanced
conversion uploads (Google Ads, Meta CAPI, GA4 Measurement Protocol, Microsoft, LinkedIn, TikTok).

Existing forms using the old fields must keep working unchanged.

## Decisions (agreed)

- One multi-input field modelled on core Name/Address fields (`inputs` + per-input `isHidden`).
- Legacy field types stay registered but lose their editor buttons. No in-place conversion.
- `app.js` remains loaded site-wide (capture must happen on landing pages without forms).
- Store Meta's `fbc` rather than raw `fbclid`.
- Storage lifetime: 90 days.
- Attribution "touch" uses GA-style last-non-direct rules.
- Consent: collect always (current behaviour). Consent gating is explicitly deferred.
- GF already records IP, user agent, source URL and date on every entry — not duplicated.
- Testing: JS logic unit-tested with `node:test`; GF integration tested manually by the user.

## Out of scope

- Consent Mode / CMP integration.
- Encoding Google's `session_attributes` blob (we capture its components instead).
- Server-side cookie setting.
- Sending conversions to any platform API.
- First-touch attribution (single last-non-direct touch only).

## File layout

| File | Change |
|---|---|
| `threesides-gf-tracking-connector.php` | Version bump to 0.2.0. |
| `class-ThreesidesGravityFormsTrackingConnector.php` | Enqueue `app.js` site-wide via `wp_enqueue_scripts` (calling parent `init_frontend`); remove duplicate `scripts()` entry; styles enqueued for the form editor; require new and legacy field classes. |
| `class-ThreesidesTrackingSignals.php` | **New.** Static registry of signals — single source of truth. |
| `class-ThreesidesTrackingField.php` | **New.** Multi-input `GF_Field`. |
| `legacy/class-Threesides*TrackingField.php` | The four existing classes moved here; `add_button()` returns `$field_groups` unchanged (no editor button). Otherwise untouched. |
| `app.js` | Rewritten: capture, storage, fill (new + legacy fields). Pure logic exported for tests when running under Node. |
| `app.css` | Add new field type selector. |
| `tests/*.test.js`, `tests/php/*` | **New.** `node:test` unit tests; plain-PHP field tests with WP/GF stand-ins. |
| `package.json` | **New.** Minimal: `"test": "node --test tests/"`. No dependencies. |
| `readme.md` | Document the new field, signals list, cookie, legacy note. |

## Signal registry

`ThreesidesTrackingSignals::all()` returns an ordered list of `[ 'key', 'label', 'input' ]`.
Input suffixes are **permanent** once released; new signals are appended. Suffixes ending in `0`
are never used (GF treats `5.10` as colliding with `5.1`).

| Input | Key | Label | Source |
|---|---|---|---|
| .1 | `ga_client_id` | GA4 Client ID | `_ga` cookie, last two dot segments |
| .2 | `ga_session_id` | GA4 Session ID | `_ga_<ID>` cookie (GS1 or GS2) |
| .3 | `gclid` | GCLID | URL → store → `_gcl_aw` fallback |
| .4 | `gbraid` | GBRAID | URL → store |
| .5 | `wbraid` | WBRAID | URL → store |
| .6 | `gad_source` | gad_source | URL (touch group) |
| .7 | `gad_campaignid` | gad_campaignid | URL (touch group) |
| .8 | `fbc` | Meta fbc | `_fbc` cookie → constructed from stored fbclid |
| .9 | `fbp` | Meta fbp | `_fbp` cookie (read at fill time only) |
| .11 | `msclkid` | Microsoft Click ID | URL → store |
| .12 | `li_fat_id` | LinkedIn li_fat_id | URL → store |
| .13 | `ttclid` | TikTok ttclid | URL → store |
| .14 | `utm_source` | utm_source | URL (touch group) |
| .15 | `utm_medium` | utm_medium | URL (touch group) |
| .16 | `utm_campaign` | utm_campaign | URL (touch group) |
| .17 | `utm_term` | utm_term | URL (touch group) |
| .18 | `utm_content` | utm_content | URL (touch group) |
| .19 | `utm_id` | utm_id | URL (touch group) |
| .21 | `landing_page` | Landing Page | `location.href` at touch time (touch group) |
| .22 | `referrer` | Referrer | `document.referrer` at touch time (touch group) |
| .23 | `touch_time` | Touch Timestamp | ISO 8601 UTC at touch time (touch group) |

PHP renders each front-end input with `data-tsm-signal="<key>"`, and `app.js` keeps its own
`SIGNAL_KEYS` list. Drift between the two is caught by a unit test that parses the PHP registry
and asserts the key lists match (no runtime config needs to be printed into the page).

## Storage (`app.js`)

**Cookie:** `_tsm_attr`, value `encodeURIComponent(JSON.stringify(state))`, `path=/`,
`max-age=7776000` (90 days), `SameSite=Lax`, `Secure` when on HTTPS. Domain: try the shortest
registrable domain by writing a probe cookie on progressively longer suffixes of `location.hostname`
(standard technique — the first suffix that accepts the cookie wins); fall back to host-only.
The cookie is only written when the state changes (new click ID, new touch, or legacy migration),
so the 90-day expiry runs from the most recent attributed visit, not the most recent page view.
If the encoded value exceeds 3,500 characters, the referrer is reduced to its origin, then the
landing page loses its query string (UTMs are already stored separately), keeping the cookie under
the browser's 4 KB limit.

**State shape:**

```json
{
  "v": 1,
  "clicks": {
    "gclid":   { "value": "...", "ts": 1760000000000 },
    "gbraid":  { "value": "...", "ts": ... },
    "wbraid":  { ... }, "fbclid": { ... }, "msclkid": { ... },
    "li_fat_id": { ... }, "ttclid": { ... }
  },
  "touch": {
    "utm_source": "", "utm_medium": "", "utm_campaign": "", "utm_term": "",
    "utm_content": "", "utm_id": "", "gad_source": "", "gad_campaignid": "",
    "landing_page": "", "referrer": "", "touch_time": "2026-10-13T01:02:03.000Z"
  }
}
```

**Click IDs (per platform, independent):** on each page load, for each click-ID param present in
the URL, replace that entry with `{ value, ts: Date.now() }` only if the value differs from the
stored one (an unchanged value keeps its original `ts`, which matters for `fbc`). Other platforms'
entries are untouched.

**Touch group (last non-direct):** replaced wholesale when the page load has any UTM, any click-ID
param, `gad_source`/`gad_campaignid`, or a referrer whose hostname is not the current site
(compared after stripping a leading `www.`; a referrer on a parent domain or subdomain of the
current host counts as internal). Otherwise (direct or internal navigation) left as is.
Missing UTMs in a new touch become empty strings — never merged with the previous touch.

**Value hygiene:** values are stored verbatim (no case change, no HTML escaping). URL-ish values
(`landing_page`, `referrer`) truncated to 500 characters; other values to 255.

**Legacy cookie migration:** if `_tsm_attr` is absent and any of `_tsm_gclid`, `_tsm_fbclid`,
`_tsm_utm` exist, seed state from them once (`_tsm_utm` split on `|` into
source|medium|campaign|content|term; `ts` = now). Legacy cookies are left in place to expire.

The broken `gform_confirmation_loaded` cookie-clearing code is removed; state persists so repeat
enquiries keep attribution.

## Read-at-fill-time values

- **`ga_client_id`:** `_ga` = `GA1.<n>.<rand>.<ts>` → `<rand>.<ts>` (last two dot segments).
  Empty if fewer than 4 segments.
- **`ga_session_id`:** first cookie matching `_ga_<ALNUM>` (if several, the first found).
  GS1 `GS1.1.<sid>.<num>...` → `<sid>`; GS2 `GS2.1.s<sid>$o<num>$...` → `<sid>`.
- **`fbp`:** `_fbp` verbatim.
- **`fbc`:** if a stored fbclid exists and `_fbc` does not contain it, construct
  `fb.1.<fbclid.ts>.<fbclid.value>` (our click is newer than the Pixel's); otherwise `_fbc`
  verbatim (empty if absent).
- **Google fallback:** if no stored gclid, take everything after `GCL.<ts>.` in `_gcl_aw`.
  No cookie fallback for gbraid/wbraid: sources disagree on which `_gcl_*` cookie holds which
  braid, and a wbraid uploaded as a gbraid is rejected. Braids come from the URL only.
  Cookie parsing splits only on the first `=` per cookie pair; only our own cookie is URL-decoded.

## Filling fields

`fill(root)` runs on `DOMContentLoaded`, on `gform/post_render` (native event, GF 2.9+), and in a
capture-phase `submit` listener on `form[id^="gform_"]` (so late-set `_ga`/`_fbp` are picked up).

- **New field:** inputs carry `data-tsm-signal="<key>"`. For each, if `input.value === ''`, set it to
  the resolved value. Never overwrite a non-empty value (preserves multi-page and save-and-continue).
- **Legacy fields** (same fill-if-empty rule, existing container class selectors):
  - GA4 client id field → `ga_client_id`
  - GCLID field → `gclid`
  - FBCLID field → raw stored `fbclid.value`
  - UTMs field → `source|medium|campaign|content|term` (legacy order)

## Field (`ThreesidesTrackingField extends GF_Field`)

- `$type = 'threesides_tracking_field'`, title "Tracking Signals", in the existing
  "Analytics and Tracking" editor group (group-creation logic moves here from the legacy classes).
- **Editor settings:** `label_setting`, `admin_label_setting`, `css_class_setting`, and a custom
  `threesides_tracking_signals_setting` rendered via `gform_field_standard_settings` containing a
  `.custom_inputs_setting` container populated with core `GetCustomizeInputsUI(field)` on
  `gform_load_field_settings`. Core then toggles `inputs[i].isHidden`.
  If the core UI fails to render on a future GF version (undocumented API), the fallback is our
  own checkbox list writing `GetSelectedField().inputs[i].isHidden` — built only if needed.
- **Defaults:** `get_form_editor_inline_script_on_page_render()` emits
  `SetDefaultValues_threesides_tracking_field(field)` that sets the label and builds
  `field.inputs` from the registry using core `new Input(field.id + '.N', label)`. No extra
  properties are stored on inputs; the signal key is always derived from the suffix.
- **`get_entry_inputs()` / `inputs`:** standard; no override needed for submission/emptiness.
- **`get_field_input()`:**
  - Editor: a short "Collecting: …" summary plus, per input, a visually hidden
    `<label for="input_{id}_{n}">` so `GetCustomizeInputsUI` finds every input; hidden inputs
    get `style="display:none"` on their container.
  - Front end: one `<input type="hidden" name="input_{id}.{n}" id="input_{formId}_{id}_{n}"
    data-tsm-signal="{key}" value="{escaped value}">` per non-hidden input, wrapped in
    `<div class="ginput_container ginput_container_threesides_tracking_field">`.
- **Saving** (see Add-on class changes for the 2.9/3.x method split): `sanitize_text_field`,
  `esc_url_raw` for `landing_page`/`referrer`, truncated to the same limits as the JS. The input
  key is resolved from `$input_name` (`input_{id}_{n}` → suffix `n`) via the registry.
- **`get_value_entry_detail()`:** small `<table>` of label/value for non-empty sub-values, escaped;
  plain `Label: value` lines when `$format === 'text'`.
- **`get_value_merge_tag()`:** for the whole-field tag, `Label: value` lines (newline / `<br>` per
  `$format`); for a sub-input tag, that value.
- **`get_value_export()`:** whole field → `Label: value` joined by `; `; sub-input → that value.
- **`get_value_entry_list()`:** whole field → count summary ("5 signals"); sub-input → value.
- `is_conditional_logic_supported()` → `false`.
- Locate the key for an input via the registry by suffix, not by trusting stored `key`
  (in case `sanitize_settings` drops unknown properties).

## Add-on class changes

- `init_frontend()`: call parent; hook `wp_enqueue_scripts` to enqueue `app.js` (no jQuery
  dependency — the rewrite uses native APIs).
- `scripts()`: remove the field-type rule for `app.js` (now site-wide).
- `styles()`: enqueue `app.css` for `admin_page => ['form_editor']` and new + legacy field types.
- `$_path`: unchanged — `GFAddOn::update_path()` already corrects a mismatched folder name.
- `$_min_gravityforms_version`: `2.9` (we rely on the native `gform/post_render` event).
  `get_value_save_input` only exists from 3.0, so the field overrides **both**
  `get_value_save_input` (called by GF 3.x) and `get_value_save_entry` (called by GF 2.9),
  each delegating to one private sanitiser. Because our `get_value_save_input` is overridden,
  GF 3.x never reaches its deprecated `get_value_save_entry` path.
- Text domain unified to `threesides-gf-tracking-connector` across all files.

## Testing

**Automated (`npm test`, Node 18+, no deps):** `app.js` ends with
`if (typeof module !== 'undefined') module.exports = { ... }` exposing pure functions, and wraps
DOM wiring in a guard so requiring it under Node has no side effects. Tests cover:

- cookie parsing (values containing `=`, encoded values, whitespace)
- `_ga` parsing (GA1.1, GA1.2, malformed)
- GS1 and GS2 session parsing
- `_gcl_aw` parsing
- fbc construction and `_fbc` preference; fbclid case preserved
- click-ID update rules (new value replaces, same value keeps ts, other platforms untouched)
- touch rules (UTM visit replaces wholesale; direct/internal leaves; external referrer replaces;
  `www.` normalisation)
- truncation limits
- legacy cookie migration incl. `_tsm_utm` field order
- legacy UTM output order

**Manual (user, GF 3.x site)** — checklist delivered with the implementation:

1. Land with `?gclid=…&gbraid=…&fbclid=…&utm_source=…` on a page without a form; confirm `_tsm_attr`.
2. Navigate internally to a form page; submit; confirm all sub-values in entry detail.
3. Untick some signals in the editor; confirm they're absent from front-end markup.
4. CSV export shows per-sub-input columns; `{Tracking Signals (GCLID):N.3}` merge tag works.
5. Feed mapping (e.g. Webhooks) lists each sub-input.
6. Multi-page form and AJAX form both populate; values survive page navigation.
7. An existing form with the four legacy fields still populates as before; legacy buttons are gone
   from the editor; old entries still display.
8. Revisit with a direct visit — touch group unchanged; with a new `utm_source` — touch replaced,
   gclid retained.
