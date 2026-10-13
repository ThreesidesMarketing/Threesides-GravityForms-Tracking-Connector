<?php

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/../../class-ThreesidesTrackingSignals.php';
require __DIR__ . '/../../class-ThreesidesTrackingField.php';

function make_field($overrides = array())
{
    return new ThreesidesTrackingField(array_merge(array(
        'id'     => 5,
        'inputs' => ThreesidesTrackingField::default_inputs(5),
    ), $overrides));
}

$form = array('id' => 2);

// # Registration and registry --------------------------------------------------------------------

check('field registers', isset(GF_Fields::$registered['threesides_tracking_field']), true);
check('registry finds by suffix', ThreesidesTrackingSignals::find_by_input('3')['key'], 'gclid');
check('registry unknown suffix', ThreesidesTrackingSignals::find_by_input(10), null);
check('url limit', ThreesidesTrackingSignals::max_length('landing_page'), 500);
check('value limit', ThreesidesTrackingSignals::max_length('gclid'), 255);

// # Inputs ---------------------------------------------------------------------------------------

$inputs = ThreesidesTrackingField::default_inputs(5);
check('one input per signal', count($inputs), count(ThreesidesTrackingSignals::all()));
check('input id format', $inputs[2]['id'], '5.3');
check('falls back to defaults when inputs missing', count(make_field(array('inputs' => null))->get_entry_inputs()), 21);

// # Front-end markup -----------------------------------------------------------------------------

$hidden_inputs = ThreesidesTrackingField::default_inputs(5);
$hidden_inputs[1]['isHidden'] = true; // GA4 Session ID
$field = make_field(array('inputs' => $hidden_inputs));
$html  = $field->get_field_input($form, array('5.3' => "G'1<x>"));

check_contains('frontend input name', $html, "name='input_5.3'");
check_contains('frontend input id', $html, "id='input_2_5_3'");
check_contains('frontend data attribute', $html, "data-tsm-signal='gclid'");
check_contains('frontend escapes value', $html, "value='G&#039;1&lt;x&gt;'");
check_not_contains('frontend skips hidden inputs', $html, "data-tsm-signal='ga_session_id'");
check_not_contains('frontend has no labels', $html, '<label');
check('frontend content is the bare field', $field->get_field_content('', false, $form), '{FIELD}');

// # Entry edit (admin) --------------------------------------------------------------------------

$edit_field = make_field(array('test_context' => 'entry_detail'));
$edit       = $edit_field->get_field_input($form, array('5.3' => 'G1'));
check_contains('entry edit keeps values so updates do not wipe them', $edit, "id='input_5_3' value='G1'");
check('entry edit uses parent chrome', $edit_field->get_field_content('', false, $form), 'PARENT_CONTENT');

// # Editor markup --------------------------------------------------------------------------------

$field->test_context = 'editor';
$editor = $field->get_field_input($form, '');
check_contains('editor label for core toggle UI', $editor, "<label for='input_5_3'>GCLID</label>");
check_contains('editor container id', $editor, "id='input_5_3_container'");
check_contains('editor shows hidden inputs collapsed', $editor, "id='input_5_2_container' style='display:none;'");
check('editor content uses parent chrome', $field->get_field_content('', false, $form), 'PARENT_CONTENT');

$script = $field->get_form_editor_inline_script_on_page_render();
check_contains('editor defaults function', $script, 'function SetDefaultValues_threesides_tracking_field(field)');
check_contains('editor defaults include signals', $script, '{"input":23,"label":"Touch Timestamp"}');
check_contains('editor binds settings', $script, 'GetCustomizeInputsUI(field)');

ob_start();
ThreesidesTrackingField::render_signals_setting(1100);
$setting = ob_get_clean();
check_contains('setting markup', $setting, 'class="custom_inputs_setting gfield_sub_setting"');
ob_start();
ThreesidesTrackingField::render_signals_setting(1050);
check('setting only at its position', ob_get_clean(), '');

// # Saving ---------------------------------------------------------------------------------------

$field = make_field();
check('save strips tags', $field->get_value_save_input(" <b>Cj0</b> abc ", $form, 'input_5_3', 1, array()), 'Cj0 abc');
check('save keeps case', $field->get_value_save_input('IwAR0AbC', $form, 'input_5_8', 1, array()), 'IwAR0AbC');
check('save truncates values', strlen($field->get_value_save_input(str_repeat('a', 300), $form, 'input_5_3', 1, array())), 255);
check('save cleans urls', $field->get_value_save_input('javascript:alert(1)', $form, 'input_5_21', 1, array()), '');
check('save keeps urls', $field->get_value_save_input('https://example.com/?a=1', $form, 'input_5_21', 1, array()), 'https://example.com/?a=1');
check('save truncates urls', strlen($field->get_value_save_input('https://example.com/' . str_repeat('a', 600), $form, 'input_5_21', 1, array())), 500);
check('save rejects arrays', $field->get_value_save_input(array('x'), $form, 'input_5_3', 1, array()), '');
check('save handles empty', $field->get_value_save_input('', $form, 'input_5_3', 1, array()), '');
check('save unknown input still sanitised', $field->get_value_save_input('<i>x</i>', $form, 'input_5', 1, array()), 'x');
check('legacy save path matches', $field->get_value_save_entry(' <b>a</b> ', $form, 'input_5_3', 1, array()), 'a');

// # Display --------------------------------------------------------------------------------------

$custom = ThreesidesTrackingField::default_inputs(5);
$custom[2]['customLabel'] = 'Google Click';
$field = make_field(array('inputs' => $custom));
$value = array('5.1' => '111.222', '5.3' => 'G<1>', '5.14' => '');

$detail = $field->get_value_entry_detail($value);
check_contains('detail uses custom sub-label', $detail, '>Google Click</th>');
check_contains('detail escapes', $detail, '<td>G&lt;1&gt;</td>');
check_not_contains('detail skips empty', $detail, 'utm_source');
check('detail text format', $field->get_value_entry_detail($value, array(), false, 'text'), "GA4 Client ID: 111.222\nGoogle Click: G<1>");
check('detail empty', $field->get_value_entry_detail(array('5.1' => '')), '');
check('detail string falls back to parent', $field->get_value_entry_detail('x'), 'PARENT:x');

// GFCommon::replace_field_variable passes rgar($raw, '5') (always '') as $value and the array as $raw_value.
check('merge tag html', $field->get_value_merge_tag('', '5', array(), $form, '', $value, false, true, 'html', false), 'GA4 Client ID: 111.222<br />Google Click: G&lt;1&gt;');
check('merge tag text', $field->get_value_merge_tag('', '5', array(), $form, '', $value, false, false, 'text', false), "GA4 Client ID: 111.222\nGoogle Click: G<1>");
check('merge tag url', $field->get_value_merge_tag('', '5', array(), $form, '', $value, true, false, 'url', false), 'GA4%20Client%20ID%3A%20111.222%0AGoogle%20Click%3A%20G%3C1%3E');
check('merge tag sub-input uses parent', $field->get_value_merge_tag('G1', '5.3', array(), $form, '', $value, false, false, 'text', false), 'PARENT:G1');

$entry = array('5.1' => '111.222', '5.3' => 'G1');
check('export whole field', $field->get_value_export($entry), 'GA4 Client ID: 111.222; Google Click: G1');
check('export whole field by id', $field->get_value_export($entry, '5'), 'GA4 Client ID: 111.222; Google Click: G1');
check('export sub-input', $field->get_value_export($entry, '5.3'), 'G1');

check('entry list count', $field->get_value_entry_list($value, array(), 5, array(), $form), '2 signals');
check('entry list singular', $field->get_value_entry_list(array('5.1' => 'x'), array(), 5, array(), $form), '1 signal');
check('entry list sub-input uses parent', $field->get_value_entry_list('G1', array(), '5.3', array(), $form), 'PARENT:G1');

finish();
