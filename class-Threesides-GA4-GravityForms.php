<?php

/**
 * Gravity Forms Add-on Class
 */
GFForms::include_addon_framework();

class Threesides_GA4_GavityForms extends GFAddOn
{

    protected $_version = Threesides_GA4_GavityForms_;
    protected $_min_gravityforms_version = '1.9';
    protected $_slug = 'threesides-ga4-gravityforms';
    protected $_path = 'threesides-ga4-gravityforms/threesides-ga4-gravityforms.php';
    protected $_full_path = __FILE__;
    protected $_title = 'GA4 Tracking for Gravity Forms';
    protected $_short_title = 'GA4 Tracking';

    private static $_instance = null;
    public static function get_instance()
    {
        if (self::$_instance == null) {
            self::$_instance = new self();
        }
        return self::$_instance;
    }

    public function pre_init()
    {
        parent::pre_init();

        if ($this->is_gravityforms_supported() && class_exists('GF_Field')) {
            require_once('class-Threesides-GA4-Tracking-Field.php');
        }
    }

    public function init_admin()
    {
        parent::init_admin();
        add_filter('gform_tooltips', array($this, 'tooltips'));
        add_action('gform_field_appearance_settings', array($this, 'field_appearance_settings'), 10, 2);
    }

    public function field_appearance_settings($position, $form_id)
    {
        // Add our custom setting just before the 'Custom CSS Class' setting.
        if ($position == 250) {
?>
            <li class="input_class_setting field_setting">
                <label for="input_class_setting">
                    <?php esc_html_e('Input CSS Classes', 'simplefieldaddon'); ?>
                    <?php gform_tooltip('input_class_setting') ?>
                </label>
                <input id="input_class_setting" type="text" class="fieldwidth-1" onkeyup="SetInputClassSetting(jQuery(this).val());" onchange="SetInputClassSetting(jQuery(this).val());" />
            </li>

<?php
        }
    }
}
