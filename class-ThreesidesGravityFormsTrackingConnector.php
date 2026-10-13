<?php

GFForms::include_addon_framework();

class ThreesidesGravityFormsTrackingConnector extends GFAddOn
{

    protected $_version = Threesides_GravityForms_TrackingConnector_Version;
    protected $_min_gravityforms_version = '2.9';
    protected $_slug = 'threesides-gf-tracking-connector';
    protected $_path = 'threesides-ga4-gravityforms/threesides-gf-tracking-connector.php';
    protected $_full_path = __FILE__;
    protected $_title = 'Threesides Gravity Forms Tracking Connector';
    protected $_short_title = 'Tracking Connector';

    /**
     * @var object $_instance If available, contains an instance of this class.
     */
    private static $_instance = null;

    /**
     * Returns an instance of this class, and stores it in the $_instance property.
     *
     * @return object $_instance An instance of this class.
     */
    public static function get_instance()
    {
        if (self::$_instance == null) {
            self::$_instance = new self();
        }

        return self::$_instance;
    }

    /**
     * Include the fields early so they are available when entry exports are being performed.
     */
    public function pre_init()
    {
        parent::pre_init();

        if (! class_exists('GF_Field')) {
            return;
        }

        // Superseded by the Tracking Signals field; kept registered so existing forms and entries keep
        // working. Loaded on any Gravity Forms version: they only need GF_Field_Hidden.
        require_once(__DIR__ . '/legacy/class-ThreesidesGa4ClientIdTrackingField.php');
        require_once(__DIR__ . '/legacy/class-ThreesidesFbclidTrackingField.php');
        require_once(__DIR__ . '/legacy/class-ThreesidesUtmsTrackingField.php');
        require_once(__DIR__ . '/legacy/class-ThreesidesGclidTrackingField.php');

        if ($this->is_gravityforms_supported()) {
            require_once(__DIR__ . '/class-ThreesidesTrackingSignals.php');
            require_once(__DIR__ . '/class-ThreesidesTrackingField.php');
        }
    }

    public function init()
    {
        parent::init();

        // Registered here (not init_frontend) so AJAX-rendered forms are covered too.
        add_filter('gform_field_css_class', array($this, 'hide_tracking_field_wrapper'), 10, 2);
    }

    public function init_admin()
    {
        parent::init_admin();

        // Only loaded on supported Gravity Forms versions (see pre_init).
        if (class_exists('ThreesidesTrackingField')) {
            add_action('gform_field_standard_settings', array('ThreesidesTrackingField', 'render_signals_setting'));
        }
    }

    public function init_frontend()
    {
        parent::init_frontend();

        add_action('wp_enqueue_scripts', array($this, 'enqueue_capture_script'));
    }

    /**
     * app.js runs on every front-end page: click IDs and UTMs arrive on landing pages that often
     * have no form, so capture cannot wait for a page with a tracking field.
     */
    public function enqueue_capture_script()
    {
        wp_enqueue_script('threesides-gravity-forms-tracking', $this->get_base_url() . '/app.js', array(), $this->_version, true);
    }

    /**
     * Gives the Tracking Signals field wrapper the core gform_hidden class on the front end, so it
     * takes no space in the form layout.
     *
     * @param string   $classes The field wrapper CSS classes.
     * @param GF_Field $field   The field being rendered.
     *
     * @return string
     */
    public function hide_tracking_field_wrapper($classes, $field)
    {
        if ($field->type !== 'threesides_tracking_field' || GFCommon::is_form_editor()) {
            return $classes;
        }

        return trim($classes . ' gform_hidden');
    }


    // # SCRIPTS & STYLES -----------------------------------------------------------------------------------------------

    /**
     * Form editor styles for the tracking fields' previews.
     *
     * @return array
     */
    public function styles()
    {
        $styles = array(
            array(
                'handle'  => 'threesides-gravity-forms-tracking',
                'src'     => $this->get_base_url() . '/app.css',
                'version' => $this->_version,
                'enqueue' => array(
                    array('admin_page' => array('form_editor')),
                )
            )
        );

        return array_merge(parent::styles(), $styles);
    }
}
