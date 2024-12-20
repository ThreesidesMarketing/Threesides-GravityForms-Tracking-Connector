# Threesides Gravity Forms Tracking Connector

Plugin for Gravity Forms that allows you to collect tracking data for offline conversion tracking.
This includes

- Google Analytics 4: Client ID
- Meta: FBCLID
- Google Ads: GCLID

## Installation

1. Click the `<> Code` button, then `Download ZIP`
2. Upload the plugin to your WordPress installation via the Add Plugin page.
3. Activate the plugin.
4. Edit your form and add the relevant tracking tags (from the Analytics and Tracking section)
5. Set up your offline conversion tracking to use this field.

## Usage

The relevant tracking tags will be populated when someone submits the form.

You can access this data from the form entries page, via API, or using the {all_fields} merge tag in emails.

## Cookie Notice

Cookies are created on any page where the form is embedded. This will capture the UTM, FBCLID or GCLID parameter for use when the form is submitted. Cookies are automatically deleted when the form is submitted.
