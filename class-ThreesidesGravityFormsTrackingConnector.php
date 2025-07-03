<?php

GFForms::include_addon_framework();

class ThreesidesGravityFormsTrackingConnector extends GFAddOn
{

    protected $_version = Threesides_GravityForms_TrackingConnector_Version;
    protected $_min_gravityforms_version = '1.9';
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
     * Include the field early so it is available when entry exports are being performed.
     */
    public function pre_init()
    {
        parent::pre_init();

        if ($this->is_gravityforms_supported() && class_exists('GF_Field')) {
            require_once('class-ThreesidesGa4ClientIdTrackingField.php');
            require_once('class-ThreesidesFbclidTrackingField.php');
            require_once('class-ThreesidesUtmsTrackingField.php');
            require_once('class-ThreesidesGclidTrackingField.php');
        }
    }

    public function init_admin()
    {
        parent::init_admin();
    }

    public function init_frontend()
    {
        parent::init_frontend();

        // Register the field types so they can be used in forms.
        wp_enqueue_script('threesides-gravity-forms-tracking', $this->get_base_url() . '/app.js', array('jquery'), $this->_version, true);
    }


    // # SCRIPTS & STYLES -----------------------------------------------------------------------------------------------

    /**
     * Include my_script.js when the form contains a 'simple' type field.
     *
     * @return array
     */
    public function scripts()
    {
        $scripts = array(
            array(
                'handle'  => 'threesides-gravity-forms-tracking',
                'src'     => $this->get_base_url() . '/app.js',
                'version' => $this->_version,
                'deps'    => array('jquery'),
                'enqueue' => array(
                    array('field_types' => array('threesides_ga4_client_id_tracking_field', 'threesides_fbclid_tracking_field', 'threesides_utms_tracking_field', 'threesides_gclid_tracking_field')),
                ),
            ),

        );

        return array_merge(parent::scripts(), $scripts);
    }

    /**
     * Include styles when the form contains a 'simple' type field.
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
                    array('field_types' => array('threesides_ga4_client_id_tracking_field', 'threesides_fbclid_tracking_field', 'threesides_utms_tracking_field', 'threesides_gclid_tracking_field')),
                )
            )
        );

        return array_merge(parent::styles(), $styles);
    }
}
