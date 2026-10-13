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
