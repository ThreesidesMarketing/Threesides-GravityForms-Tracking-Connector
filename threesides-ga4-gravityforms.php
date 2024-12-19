<?php

/**
 * Plugin Name: ThreeSides GA4 Tracking Connector
 * Plugin URI: https://github.com/ThreesidesMarketing/threesides-ga4-gravityforms
 * Description: Plugin for Gravity Forms that adds a hidden field, allowing  you to collect GA4 tracking cookie for offline conversion tracking.
 * Version: 1.0.3
 * Author: Threesides Marketing
 * Author URI: https://threesides.com.au
 * License: MIT
 * Text Domain: threesides-ga4-gravityforms
 */

function threesides_ga4_gravityforms_scripts()
{
    wp_enqueue_script('threesides-ga4-gravityforms', plugin_dir_url(__FILE__) . 'app.js', array('jquery'), '1.0.0', true);
}

add_action('wp_enqueue_scripts', 'threesides_ga4_gravityforms_scripts');


define('Threesides_GA4_GavityForms_Version', '1.0');
add_action('gform_loaded', array('Threesides_GA4_GravtyForms_Bootstrap', 'load'), 5);

class Threesides_GA4_GravtyForms_Bootstrap
{

    public static function load()
    {

        if (! method_exists('GFForms', 'include_addon_framework')) {
            return;
        }

        require_once('classThreesidesGA4GravityForms.php');

        GFAddOn::register('ThreesidesGA4GavityFormsAddOn');
    }
}
