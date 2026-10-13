<?php

/** Tracking Signals registry: the single list of signals the Tracking Signals field collects. */

if (! class_exists('GFForms')) {
    die();
}

class ThreesidesTrackingSignals
{

    /**
     * Every signal, in display order.
     *
     * Input suffixes become sub-input IDs (field 5, input 3 => "5.3") and are stored in entries and
     * feed mappings, so they are permanent: append new signals, never renumber or reuse a suffix,
     * and never use a suffix ending in 0 (Gravity Forms treats "5.10" as "5.1").
     *
     * Keys must match SIGNAL_KEYS in app.js (enforced by tests/registry.test.js).
     *
     * @return array[] Each signal: input (int), key (string), label (string).
     */
    public static function all()
    {
        return array(
            array('input' => 1, 'key' => 'ga_client_id', 'label' => __('GA4 Client ID', 'threesides-gf-tracking-connector')),
            array('input' => 2, 'key' => 'ga_session_id', 'label' => __('GA4 Session ID', 'threesides-gf-tracking-connector')),
            array('input' => 3, 'key' => 'gclid', 'label' => __('GCLID', 'threesides-gf-tracking-connector')),
            array('input' => 4, 'key' => 'gbraid', 'label' => __('GBRAID', 'threesides-gf-tracking-connector')),
            array('input' => 5, 'key' => 'wbraid', 'label' => __('WBRAID', 'threesides-gf-tracking-connector')),
            array('input' => 6, 'key' => 'gad_source', 'label' => __('gad_source', 'threesides-gf-tracking-connector')),
            array('input' => 7, 'key' => 'gad_campaignid', 'label' => __('gad_campaignid', 'threesides-gf-tracking-connector')),
            array('input' => 8, 'key' => 'fbc', 'label' => __('Meta fbc', 'threesides-gf-tracking-connector')),
            array('input' => 9, 'key' => 'fbp', 'label' => __('Meta fbp', 'threesides-gf-tracking-connector')),
            array('input' => 11, 'key' => 'msclkid', 'label' => __('Microsoft Click ID', 'threesides-gf-tracking-connector')),
            array('input' => 12, 'key' => 'li_fat_id', 'label' => __('LinkedIn li_fat_id', 'threesides-gf-tracking-connector')),
            array('input' => 13, 'key' => 'ttclid', 'label' => __('TikTok ttclid', 'threesides-gf-tracking-connector')),
            array('input' => 14, 'key' => 'utm_source', 'label' => __('utm_source', 'threesides-gf-tracking-connector')),
            array('input' => 15, 'key' => 'utm_medium', 'label' => __('utm_medium', 'threesides-gf-tracking-connector')),
            array('input' => 16, 'key' => 'utm_campaign', 'label' => __('utm_campaign', 'threesides-gf-tracking-connector')),
            array('input' => 17, 'key' => 'utm_term', 'label' => __('utm_term', 'threesides-gf-tracking-connector')),
            array('input' => 18, 'key' => 'utm_content', 'label' => __('utm_content', 'threesides-gf-tracking-connector')),
            array('input' => 19, 'key' => 'utm_id', 'label' => __('utm_id', 'threesides-gf-tracking-connector')),
            array('input' => 21, 'key' => 'landing_page', 'label' => __('Landing Page', 'threesides-gf-tracking-connector')),
            array('input' => 22, 'key' => 'referrer', 'label' => __('Referrer', 'threesides-gf-tracking-connector')),
            array('input' => 23, 'key' => 'touch_time', 'label' => __('Touch Timestamp', 'threesides-gf-tracking-connector')),
        );
    }

    /**
     * @param int|string $suffix The part of a sub-input ID after the dot.
     *
     * @return array|null The signal, or null if the suffix is unknown.
     */
    public static function find_by_input($suffix)
    {
        foreach (self::all() as $signal) {
            if ($signal['input'] === (int) $suffix) {
                return $signal;
            }
        }

        return null;
    }

    /**
     * @param string $key A signal key.
     *
     * @return bool Whether the signal holds a URL.
     */
    public static function is_url($key)
    {
        return in_array($key, array('landing_page', 'referrer'), true);
    }

    /**
     * Mirrors the truncation limits in app.js.
     *
     * @param string $key A signal key.
     *
     * @return int Maximum stored length.
     */
    public static function max_length($key)
    {
        return self::is_url($key) ? 500 : 255;
    }
}
