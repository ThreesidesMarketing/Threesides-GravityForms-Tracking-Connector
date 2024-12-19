<?php

/**
 * Plugin Name: Threesides Gravity Forms Tracking Connector
 * Plugin URI: https://github.com/ThreesidesMarketing/threesides-ga4-gravityforms
 * Description: Plugin for Gravity Forms that adds a hidden fields allowing you to collect relevant tracking data for offline conversion tracking. 
 * Version: 0.0.2
 * Author: Threesides Marketing
 * Author URI: https://threesides.com.au
 * License: MIT
 * Text Domain: threesides-gf-tracking-connector
 */

define('Threesides_GravityForms_TrackingConnector_Version', '0.0.2');
add_action('gform_loaded', array('ThreesidesGravityFormsTrackingConnector_Bootstrap', 'load'), 5);

class ThreesidesGravityFormsTrackingConnector_Bootstrap
{

    public static function load()
    {

        if (! method_exists('GFForms', 'include_addon_framework')) {
            return;
        }

        require_once('class-ThreesidesGravityFormsTrackingConnector.php');

        GFAddOn::register('ThreesidesGravityFormsTrackingConnector');
    }
}
