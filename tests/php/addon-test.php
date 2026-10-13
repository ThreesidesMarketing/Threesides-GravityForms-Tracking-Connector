<?php

require __DIR__ . '/bootstrap.php';

// # Add-on framework stand-ins ------------------------------------------------------------------

define('Threesides_GravityForms_TrackingConnector_Version', '0.0.0-test');

$GLOBALS['tsm_gf_supported'] = false;
$GLOBALS['tsm_hooks'] = array();

class GFAddOn
{
    public function pre_init()
    {
    }

    public function init()
    {
    }

    public function init_admin()
    {
    }

    public function init_frontend()
    {
    }

    public function is_gravityforms_supported()
    {
        return $GLOBALS['tsm_gf_supported'];
    }

    public function styles()
    {
        return array();
    }
}

function add_action($hook, $callback)
{
    $GLOBALS['tsm_hooks'][$hook][] = $callback;
}

function add_filter($hook, $callback)
{
    $GLOBALS['tsm_hooks'][$hook][] = $callback;
}

require __DIR__ . '/../../class-ThreesidesGravityFormsTrackingConnector.php';

$legacy_types = array(
    'threesides_ga4_client_id_tracking_field',
    'threesides_fbclid_tracking_field',
    'threesides_utms_tracking_field',
    'threesides_gclid_tracking_field',
);

// # Gravity Forms older than the minimum version ------------------------------------------------

$addon = new ThreesidesGravityFormsTrackingConnector();
$addon->pre_init();
$addon->init_admin();

foreach ($legacy_types as $type) {
    check("unsupported GF: {$type} still registered so existing forms keep collecting", isset(GF_Fields::$registered[$type]), true);
}
check('unsupported GF: new field not loaded', class_exists('ThreesidesTrackingField', false), false);
check('unsupported GF: no settings hook pointing at an unloaded class', isset($GLOBALS['tsm_hooks']['gform_field_standard_settings']), false);

// # Supported Gravity Forms ---------------------------------------------------------------------

$GLOBALS['tsm_gf_supported'] = true;
$GLOBALS['tsm_hooks'] = array();
$addon = new ThreesidesGravityFormsTrackingConnector();
$addon->pre_init();
$addon->init_admin();

check('supported GF: new field registered', isset(GF_Fields::$registered['threesides_tracking_field']), true);
check('supported GF: settings hook registered', $GLOBALS['tsm_hooks']['gform_field_standard_settings'] ?? null, array(array('ThreesidesTrackingField', 'render_signals_setting')));

finish();
