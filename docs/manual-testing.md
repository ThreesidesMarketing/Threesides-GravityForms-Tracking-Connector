# Manual Testing Checklist

Run on a WordPress site with Gravity Forms 3.x (and once on 2.9 if you support it), with the plugin
active and page caching off for the first pass. Use a private window per scenario so cookies start
clean. Check cookies in DevTools → Application → Cookies.

Setup: a form ("Test") containing a Tracking Signals field plus a Name field, embedded on `/contact`.
Note the field's ID (shown in the editor); the steps below call it `N`.

## 1. Editor

- [ ] Analytics and Tracking group shows **Tracking Signals** and none of GA4 Client ID / GCLID /
      FBCLID / UTMs.
- [ ] Adding the field shows "These signals will be collected:" with all 21 signals listed.
- [ ] **Signals to collect** shows a toggle per signal. Turning one off hides it from the preview
      list immediately; saving and reloading the form keeps it off.
- [ ] A custom sub-label typed in that table appears in the preview after saving.

## 2. Capture on a page without a form

- [ ] Visit `/?gclid=TESTG&gbraid=TESTGB&fbclid=TestFb&utm_source=google&utm_medium=cpc&utm_campaign=brand`
      on a page that has **no** form.
- [ ] A `_tsm_attr` cookie exists, scoped to the root domain (e.g. `.example.com`), expiring in 90 days.

## 3. Submission

- [ ] Navigate internally to `/contact` and submit.
- [ ] Entry detail shows a table with GCLID `TESTG`, GBRAID `TESTGB`, Meta fbc `fb.1.<13 digits>.TestFb`
      (case preserved), utm_source/medium/campaign, Landing Page (the step 2 URL), Touch Timestamp,
      and GA4 Client ID / Meta fbp if those tags run on the site.
- [ ] Signals turned off in step 1 are absent from the entry and from the page source.
- [ ] Repeat with the form set to AJAX submission: same values saved (confirms our submit listener
      runs before Gravity Forms reads the form).
- [ ] On a fresh private window, land directly on `/contact?gclid=FIRSTHIT` and submit within a
      second or two: GA4 Client ID is still captured if GA4 is installed (filled at submit time).

## 4. Outputs

- [ ] Entries list: the field column shows "N signals"; individual sub-fields can be added as columns.
- [ ] Export entries: each signal is offered as its own column and exports its value.
- [ ] A notification using `{all_fields}` lists the collected signals; one using
      `{Tracking Signals (GCLID):N.3}` shows just the GCLID.
- [ ] A feed (e.g. Webhooks or HubSpot) lists each signal separately in its field mapping.
- [ ] Editing the entry in the admin and clicking Update keeps every signal value.

## 5. Attribution rules

- [ ] After step 3, visit `/about` directly (type the URL): `_tsm_attr` is unchanged.
- [ ] Visit `/?utm_source=newsletter`: submit again; utm_source is `newsletter`, utm_medium and
      utm_campaign are empty, and GCLID is still `TESTG`.
- [ ] Arrive from an external site (click a link to the site from another domain): the touch's
      referrer updates and UTMs are cleared; GCLID is still `TESTG`.

## 6. Multi-page and re-rendered forms

- [ ] Multi-page form (Tracking Signals on page 1): values survive to the final submission.
- [ ] Multi-page form with AJAX enabled: same.
- [ ] Save and Continue: resume from the emailed link and submit; the original values are kept.

## 7. Legacy fields

- [ ] An existing form with the old GA4 Client ID / GCLID / FBCLID / UTMs fields still populates
      them on submission (UTMs as `source|medium|campaign|content|term`, FBCLID as the raw fbclid).
- [ ] Old entries from before the upgrade still display their values.
- [ ] A visitor who had the old `_tsm_gclid` cookie keeps their GCLID after the upgrade.

## 8. Caching

- [ ] With page caching on (e.g. WP Engine), repeat steps 2–3: values are still captured
      (collection is fully client-side, so cached pages must still work).
