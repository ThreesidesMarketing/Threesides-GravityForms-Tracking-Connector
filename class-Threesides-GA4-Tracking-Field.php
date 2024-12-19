<?php
class Threesides_GA4_Tracking_Field extends GF_Field
{
    public $_type = 'simple';
    public function get_form_editor_field_title()
    {
        return esc_attr__('Simple', 'simplefieldaddon');
    }
    public function get_form_editor_button()
    {
        return array(
            'group' => 'advanced_fields',
            'text'  => $this->get_form_editor_field_title(),
        );
    }
}

GF_Fields::register(new Threesides_GA4_Tracking_Field());
