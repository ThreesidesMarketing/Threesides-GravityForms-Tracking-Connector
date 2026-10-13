<?php

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/../../legacy/class-ThreesidesGa4ClientIdTrackingField.php';
require __DIR__ . '/../../legacy/class-ThreesidesFbclidTrackingField.php';
require __DIR__ . '/../../legacy/class-ThreesidesUtmsTrackingField.php';
require __DIR__ . '/../../legacy/class-ThreesidesGclidTrackingField.php';

$groups = array(array('name' => 'standard_fields', 'label' => 'Standard', 'fields' => array()));

foreach (array(
    'threesides_ga4_client_id_tracking_field',
    'threesides_fbclid_tracking_field',
    'threesides_utms_tracking_field',
    'threesides_gclid_tracking_field',
) as $type) {
    check("{$type} stays registered", isset(GF_Fields::$registered[$type]), true);
    check("{$type} has no editor button", GF_Fields::$registered[$type]->add_button($groups), $groups);
}

finish();
