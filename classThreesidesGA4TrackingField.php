<?php

if (! class_exists('GFForms')) {
    die();
}

class ThreesidesGA4TrackingField extends GF_Field_Hidden
{

    /**
     * @var string $type The field type.
     */
    public $type = 'ga4_tracking';

    /**
     * Return the field title, for use in the form editor.
     *
     * @return string
     */
    public function get_form_editor_field_title()
    {
        return esc_attr__('Ads Tracking', 'threesides-ga4-gravityforms');
    }

    /**
     * Assign the field button to the Advanced Fields group.
     *
     * @return array
     */
    public function get_form_editor_button()
    {
        return array(
            'group' => 'advanced_fields',
            'text'  => $this->get_form_editor_field_title(),
        );
    }

    /**
     * The settings which should be available on the field in the form editor.
     *
     * @return array
     */
    function get_form_editor_field_settings()
    {
        return array(
            'label_setting',
        );
    }

    /**
     * Enable this field for use with conditional logic.
     *
     * @return bool
     */
    public function is_conditional_logic_supported()
    {
        return false;
    }

    /**
     * The scripts to be included in the form editor.
     *
     * @return string
     */
    public function get_form_editor_inline_script_on_page_render()
    {

        // set the default field label for the simple type field
        $script = sprintf("function SetDefaultValues_ga4_tracking(field) {field.label = '%s';}", $this->get_form_editor_field_title()) . PHP_EOL;

        // initialize the fields custom settings
        // $script .= "jQuery(document).bind('gform_load_field_settings', function (event, field, form) {" .
        //     "var inputClass = field.inputClass == undefined ? '' : field.inputClass;" .
        //     "jQuery('#input_class_setting').val(inputClass);" .
        //     "});" . PHP_EOL;

        // saving the simple setting
        // $script .= "function SetInputClassSetting(value) {SetFieldProperty('inputClass', value);}" . PHP_EOL;

        return $script;
    }

    /**
     * Define the fields inner markup.
     *
     * @param array $form The Form Object currently being processed.
     * @param string|array $value The field value. From default/dynamic population, $_POST, or a resumed incomplete submission.
     * @param null|array $entry Null or the Entry Object currently being edited.
     *
     * @return string
     */
    public function get_field_input($form, $value = '', $entry = null)
    {
        $id              = absint($this->id);
        $form_id         = absint($form['id']);
        $is_entry_detail = $this->is_entry_detail();
        $is_form_editor  = $this->is_form_editor();

        // Prepare the value of the input ID attribute.
        $field_id = $is_entry_detail || $is_form_editor || $form_id == 0 ? "input_$id" : 'input_' . $form_id . "_$id";

        $value = esc_attr($value);

        // Get the value of the inputClass property for the current field.
        $inputClass = $this->inputClass;

        // Prepare the input classes.
        $size         = $this->size;
        $class_suffix = $is_entry_detail ? '_admin' : '';
        $class        = $size . $class_suffix . ' ' . $inputClass;

        // Prepare the other input attributes.
        $tabindex              = $this->get_tabindex();
        $logic_event           = ! $is_form_editor && ! $is_entry_detail ? $this->get_conditional_logic_event('keyup') : '';
        $placeholder_attribute = $this->get_field_placeholder_attribute();
        $required_attribute    = $this->isRequired ? 'aria-required="true"' : '';
        $invalid_attribute     = $this->failed_validation ? 'aria-invalid="true"' : 'aria-invalid="false"';
        $disabled_text         = $is_form_editor ? 'disabled="disabled"' : '';

        // Prepare the input tag for this field.


        $input = '<input type="hidden" name="utms"><input type="hidden" name="ga4_client_id"><input type="hidden" name="gclid"><input type="hidden" name="fbclid">';
        $input .= "<input name='input_{$id}' id='{$field_id}' type='text' value='{$value}' class='{$class}' {$tabindex} {$logic_event} {$placeholder_attribute} {$required_attribute} {$invalid_attribute} {$disabled_text}/>";

        return sprintf("<div class='ginput_container ginput_container_%s'>%s</div>", $this->type, $input);
    }
}

GF_Fields::register(new ThreesidesGA4TrackingField());
