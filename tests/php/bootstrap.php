<?php

/**
 * Minimal WordPress / Gravity Forms stand-ins so the field class can be tested with plain PHP.
 * They approximate core behaviour only as far as the tests need; they are not a WordPress port.
 */

class GFForms
{
}

class GF_Fields
{
    public static $registered = array();

    public static function register($field)
    {
        self::$registered[$field->type] = $field;
    }
}

class GF_Field
{
    public $id;
    public $type;
    public $inputs;
    public $test_context = 'frontend';

    public function __construct($properties = array())
    {
        foreach ($properties as $name => $value) {
            $this->$name = $value;
        }
    }

    public function is_form_editor()
    {
        return $this->test_context === 'editor';
    }

    public function is_entry_detail()
    {
        return $this->test_context === 'entry_detail';
    }

    public function add_button($field_groups)
    {
        return $field_groups;
    }

    public function get_field_content($value, $force_frontend_label, $form)
    {
        return 'PARENT_CONTENT';
    }

    public function get_value_entry_detail($value, $entry = array(), $use_text = false, $format = 'html', $media = 'screen')
    {
        return 'PARENT:' . $value;
    }

    public function get_value_merge_tag($value, $input_id, $entry, $form, $modifier, $raw_value, $url_encode, $esc_html, $format, $nl2br)
    {
        return 'PARENT:' . $value;
    }

    public function get_value_export($entry, $input_id = '', $use_text = false, $is_csv = false)
    {
        return rgar($entry, $input_id);
    }

    public function get_value_entry_list($value, $entry, $field_id, $columns, $form)
    {
        return 'PARENT:' . $value;
    }
}

class GF_Field_Hidden extends GF_Field
{
}

function __($text, $domain = 'default')
{
    return $text;
}

function _n($single, $plural, $number, $domain = 'default')
{
    return $number == 1 ? $single : $plural;
}

function esc_html($text)
{
    return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
}

function esc_attr($text)
{
    return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
}

function esc_attr__($text, $domain = 'default')
{
    return esc_attr($text);
}

function esc_html__($text, $domain = 'default')
{
    return esc_html($text);
}

function esc_html_e($text, $domain = 'default')
{
    echo esc_html($text);
}

function wp_json_encode($data)
{
    return json_encode($data);
}

function absint($value)
{
    return abs((int) $value);
}

function rgar($array, $key)
{
    return is_array($array) && isset($array[$key]) ? $array[$key] : '';
}

function rgblank($value)
{
    return $value === null || $value === '' || $value === array();
}

function sanitize_text_field($text)
{
    return trim(preg_replace('/\s+/', ' ', strip_tags((string) $text)));
}

function esc_url_raw($url)
{
    return preg_match('#^https?://#i', (string) $url) ? str_replace(array('"', "'", '<', '>', ' '), '', (string) $url) : '';
}

// # A tiny test runner -------------------------------------------------------------------------

$GLOBALS['tsm_failures'] = 0;
$GLOBALS['tsm_passes'] = 0;

function check($name, $actual, $expected)
{
    if ($actual === $expected) {
        $GLOBALS['tsm_passes']++;
        return;
    }
    $GLOBALS['tsm_failures']++;
    fwrite(STDERR, "FAIL: {$name}\n  expected: " . var_export($expected, true) . "\n  actual:   " . var_export($actual, true) . "\n");
}

function check_contains($name, $haystack, $needle)
{
    check($name . ' (contains ' . $needle . ')', strpos($haystack, $needle) !== false, true);
}

function check_not_contains($name, $haystack, $needle)
{
    check($name . ' (does not contain ' . $needle . ')', strpos($haystack, $needle) === false, true);
}

function finish()
{
    echo "{$GLOBALS['tsm_passes']} passed, {$GLOBALS['tsm_failures']} failed\n";
    exit($GLOBALS['tsm_failures'] > 0 ? 1 : 0);
}
