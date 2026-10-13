<?php

/** Tracking Signals Field: one hidden sub-input per tracking signal, filled by app.js. */

if (! class_exists('GFForms')) {
    die();
}

class ThreesidesTrackingField extends GF_Field
{

    /**
     * @var string $type The field type.
     */
    public $type = 'threesides_tracking_field';

    /**
     * Return the field title, for use in the form editor.
     *
     * @return string
     */
    public function get_form_editor_field_title()
    {
        return esc_attr__('Tracking Signals', 'threesides-gf-tracking-connector');
    }

    /**
     * Return the field description, for use in the form editor.
     *
     * @return string
     */
    public function get_form_editor_field_description()
    {
        return esc_attr__('Collects analytics IDs, ad click IDs and UTMs for offline conversion tracking.', 'threesides-gf-tracking-connector');
    }

    /**
     * Adds the field button to the specified group.
     *
     * @param array $field_groups The field groups containing the individual field buttons.
     *
     * @return array
     */
    public function add_button($field_groups)
    {
        $field_groups = self::maybe_add_field_group($field_groups);

        return parent::add_button($field_groups);
    }

    /**
     * Adds the custom field group if it doesn't already exist.
     *
     * @param array $field_groups The field groups containing the individual field buttons.
     *
     * @return array
     */
    public static function maybe_add_field_group($field_groups)
    {
        foreach ($field_groups as $field_group) {
            if ($field_group['name'] == 'threesides_gf_tracking_connector') {
                return $field_groups;
            }
        }

        $field_groups[] = array(
            'name'   => 'threesides_gf_tracking_connector',
            'label'  => __('Analytics and Tracking', 'threesides-gf-tracking-connector'),
            'fields' => array()
        );

        return $field_groups;
    }

    /**
     * Assign the field button to the custom group.
     *
     * @return array
     */
    public function get_form_editor_button()
    {
        return array(
            'group' => 'threesides_gf_tracking_connector',
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
            'admin_label_setting',
            'css_class_setting',
            'threesides_tracking_signals_setting',
        );
    }

    /**
     * Tracking values are not user input, so conditional logic on them is not offered.
     *
     * @return bool
     */
    public function is_conditional_logic_supported()
    {
        return false;
    }

    /**
     * The field's sub-inputs. Falls back to every signal if the form has none stored.
     *
     * @return array
     */
    public function get_entry_inputs()
    {
        return is_array($this->inputs) && ! empty($this->inputs) ? $this->inputs : self::default_inputs($this->id);
    }

    /**
     * @param int $field_id The field ID.
     *
     * @return array One input per registered signal.
     */
    public static function default_inputs($field_id)
    {
        $inputs = array();
        foreach (ThreesidesTrackingSignals::all() as $signal) {
            $inputs[] = array(
                'id'    => $field_id . '.' . $signal['input'],
                'label' => $signal['label'],
                'name'  => '',
            );
        }

        return $inputs;
    }

    /**
     * @param string $input_id A sub-input ID such as "5.3".
     *
     * @return int The suffix after the dot, or 0.
     */
    private static function input_suffix($input_id)
    {
        $parts = explode('.', (string) $input_id);

        return isset($parts[1]) ? absint($parts[1]) : 0;
    }

    /**
     * @param array $input A sub-input.
     *
     * @return string The admin's custom sub-label if set, otherwise the default label.
     */
    private static function input_label($input)
    {
        return rgar($input, 'customLabel') ? $input['customLabel'] : rgar($input, 'label');
    }

    /**
     * Sets default sub-inputs for new fields and renders the show/hide toggles using the same
     * core UI as the Name and Address fields.
     *
     * @return string
     */
    public function get_form_editor_inline_script_on_page_render()
    {
        $signals = array();
        foreach (ThreesidesTrackingSignals::all() as $signal) {
            $signals[] = array('input' => $signal['input'], 'label' => $signal['label']);
        }

        $script = sprintf(
            'function SetDefaultValues_threesides_tracking_field(field) {' .
                'field.label = %s;' .
                'field.inputs = %s.map(function (signal) { return new Input(field.id + "." + signal.input, signal.label); });' .
            '}',
            wp_json_encode($this->get_form_editor_field_title()),
            wp_json_encode($signals)
        ) . PHP_EOL;

        $script .= 'jQuery(document).on("gform_load_field_settings", function (event, field) {' .
                'if (field.type === "threesides_tracking_field") {' .
                    'jQuery("#threesides_tracking_signals_container").html(GetCustomizeInputsUI(field));' .
                '}' .
            '});' . PHP_EOL;

        return $script;
    }

    /**
     * Renders the "Signals to collect" setting container. Hooked to gform_field_standard_settings.
     *
     * The wrapper must carry the custom_inputs_setting class: core binds its show/hide toggle
     * handler to that class when the editor loads.
     *
     * @param int $position The settings position being rendered.
     */
    public static function render_signals_setting($position)
    {
        if ($position != 1100) {
            return;
        }
        ?>
        <li class="threesides_tracking_signals_setting field_setting">
            <div class="custom_inputs_setting gfield_sub_setting">
                <span class="section_label"><?php esc_html_e('Signals to collect', 'threesides-gf-tracking-connector'); ?></span>
                <div id="threesides_tracking_signals_container"></div>
            </div>
        </li>
        <?php
    }

    /**
     * Front end: inputs only, no label or wrapper markup. Admin: the standard field chrome.
     *
     * @param string|array $value                The field value.
     * @param bool         $force_frontend_label Whether to force the frontend label.
     * @param array        $form                 The Form Object currently being processed.
     *
     * @return string
     */
    public function get_field_content($value, $force_frontend_label, $form)
    {
        if ($this->is_form_editor() || $this->is_entry_detail()) {
            return parent::get_field_content($value, $force_frontend_label, $form);
        }

        return '{FIELD}';
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
        $form_id        = absint(rgar($form, 'id'));
        $field_id       = absint($this->id);
        $is_form_editor = $this->is_form_editor();
        $use_short_id   = $is_form_editor || $this->is_entry_detail() || $form_id == 0;
        $values         = is_array($value) ? $value : array();
        $markup         = '';

        foreach ($this->get_entry_inputs() as $input) {
            $suffix = self::input_suffix($input['id']);
            $signal = ThreesidesTrackingSignals::find_by_input($suffix);
            if (! $signal) {
                continue;
            }

            $html_id   = $use_short_id ? "input_{$field_id}_{$suffix}" : "input_{$form_id}_{$field_id}_{$suffix}";
            $is_hidden = ! empty($input['isHidden']);

            if ($is_form_editor) {
                // GetCustomizeInputsUI() skips inputs without a matching label[for], and toggles #<id>_container.
                $markup .= sprintf(
                    "<li id='%1\$s_container'%2\$s><label for='%1\$s'>%3\$s</label><input type='hidden' id='%1\$s' disabled='disabled' /></li>",
                    esc_attr($html_id),
                    $is_hidden ? " style='display:none;'" : '',
                    esc_html(self::input_label($input))
                );
                continue;
            }

            if ($is_hidden) {
                continue;
            }

            $markup .= sprintf(
                "<input type='hidden' name='input_%d.%d' id='%s' value='%s' data-tsm-signal='%s' />",
                $field_id,
                $suffix,
                esc_attr($html_id),
                esc_attr(rgar($values, (string) $input['id'])),
                esc_attr($signal['key'])
            );
        }

        if ($is_form_editor) {
            $markup = sprintf(
                "<p>%s</p><ul class='threesides-tracking-signals'>%s</ul>",
                esc_html__('These signals will be collected:', 'threesides-gf-tracking-connector'),
                $markup
            );
        }

        return sprintf("<div class='ginput_container ginput_container_%s'>%s</div>", $this->type, $markup);
    }

    /**
     * Sanitize a sub-input value before saving (Gravity Forms 3.0+).
     *
     * @return string
     */
    public function get_value_save_input($value, $form, $input_name, $entry_id, $entry, $repeater_index = '')
    {
        return $this->sanitize_signal_value($value, $input_name);
    }

    /**
     * Sanitize a sub-input value before saving (Gravity Forms 2.9; deprecated in 3.0).
     *
     * @return string
     */
    public function get_value_save_entry($value, $form, $input_name, $lead_id, $lead)
    {
        return $this->sanitize_signal_value($value, $input_name);
    }

    /**
     * @param mixed  $value      The submitted value.
     * @param string $input_name The POST name, e.g. "input_5_3".
     *
     * @return string
     */
    private function sanitize_signal_value($value, $input_name)
    {
        if (is_array($value) || rgblank($value)) {
            return '';
        }

        $signal = preg_match('/^input_\d+_(\d+)$/', (string) $input_name, $match) ? ThreesidesTrackingSignals::find_by_input($match[1]) : null;
        $key    = $signal ? $signal['key'] : '';
        $value  = ThreesidesTrackingSignals::is_url($key) ? esc_url_raw($value) : sanitize_text_field($value);

        return mb_substr($value, 0, ThreesidesTrackingSignals::max_length($key));
    }

    /**
     * @param array $values Values keyed by sub-input ID (a field value or an entry).
     *
     * @return array[] [label, value] pairs for every non-empty sub-input.
     */
    private function signal_rows($values)
    {
        $rows = array();
        foreach ($this->get_entry_inputs() as $input) {
            $input_value = rgar($values, (string) $input['id']);
            if (! rgblank($input_value)) {
                $rows[] = array(self::input_label($input), $input_value);
            }
        }

        return $rows;
    }

    /**
     * @param array[] $rows [label, value] pairs.
     *
     * @return string[] "Label: value" lines.
     */
    private static function rows_as_lines($rows)
    {
        $lines = array();
        foreach ($rows as $row) {
            $lines[] = $row[0] . ': ' . $row[1];
        }

        return $lines;
    }

    /**
     * Entry detail and {all_fields}: a table of the collected signals.
     *
     * @return string
     */
    public function get_value_entry_detail($value, $entry = array(), $use_text = false, $format = 'html', $media = 'screen')
    {
        if (! is_array($value)) {
            return parent::get_value_entry_detail($value, $entry, $use_text, $format, $media);
        }

        $rows = $this->signal_rows($value);
        if (empty($rows)) {
            return '';
        }

        if ($format === 'text') {
            return implode("\n", self::rows_as_lines($rows));
        }

        $html = '';
        foreach ($rows as $row) {
            $html .= sprintf(
                "<tr><th scope='row' style='text-align:left;padding-right:1em;'>%s</th><td>%s</td></tr>",
                esc_html($row[0]),
                esc_html($row[1])
            );
        }

        return "<table class='threesides-tracking-signals-table'><tbody>{$html}</tbody></table>";
    }

    /**
     * Whole-field merge tag: "Label: value" lines. Sub-input merge tags use the core behaviour.
     *
     * @return string
     */
    public function get_value_merge_tag($value, $input_id, $entry, $form, $modifier, $raw_value, $url_encode, $esc_html, $format, $nl2br)
    {
        // Core passes the whole-field tag's value as rgar($raw_value, '<field id>'), i.e. '', so the
        // signals have to come from $raw_value.
        if (! is_array($raw_value) || strpos((string) $input_id, '.') !== false) {
            return parent::get_value_merge_tag($value, $input_id, $entry, $form, $modifier, $raw_value, $url_encode, $esc_html, $format, $nl2br);
        }

        $lines = self::rows_as_lines($this->signal_rows($raw_value));
        foreach ($lines as &$line) {
            if ($url_encode) {
                $line = rawurlencode($line);
            } elseif ($esc_html || $format === 'html') {
                $line = esc_html($line);
            }
        }
        unset($line);

        if ($url_encode) {
            return implode('%0A', $lines);
        }

        return implode($format === 'html' ? '<br />' : "\n", $lines);
    }

    /**
     * Whole-field export: "Label: value" pairs joined by "; ". Sub-inputs export as-is.
     *
     * @return string
     */
    public function get_value_export($entry, $input_id = '', $use_text = false, $is_csv = false)
    {
        if (empty($input_id) || strpos((string) $input_id, '.') === false) {
            return implode('; ', self::rows_as_lines($this->signal_rows($entry)));
        }

        return parent::get_value_export($entry, $input_id, $use_text, $is_csv);
    }

    /**
     * Entry list: a count for the whole-field column; sub-input columns use the core behaviour.
     *
     * @return string
     */
    public function get_value_entry_list($value, $entry, $field_id, $columns, $form)
    {
        if (! is_array($value)) {
            return parent::get_value_entry_list($value, $entry, $field_id, $columns, $form);
        }

        $count = count($this->signal_rows($value));

        /* translators: %d: number of tracking signals collected. */
        return esc_html(sprintf(_n('%d signal', '%d signals', $count, 'threesides-gf-tracking-connector'), $count));
    }
}

GF_Fields::register(new ThreesidesTrackingField());
