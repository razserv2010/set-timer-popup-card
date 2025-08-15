# set-timer-popup-card

> **Note:** This project is a **fork** of the original [Switch timer popup card](https://github.com/gh0stblizz4rd/ha-switch-timer) project by **gh0stblizz4rd**.  
> All credit for the original idea and implementation goes to the original author.  
> This fork includes my own modifications, improvements, and customizations.

Lovelace card intended for use with [Switch timer](https://github.com/gh0stblizz4rd/ha-switch-timer) integration.  
Schedule a timer by using a [browser_mod](https://github.com/thomasloven/hass-browser_mod) popup.

<p>
    <img src="https://i.imgur.com/s3wWdru.png" width="500px"/>
</p>

This card is designed to be placed inside a [browser_mod](https://github.com/thomasloven/hass-browser_mod) popup.  
The card will close the popup after 500 milliseconds automatically when a timer is scheduled (Requires your browser to be registered in browser_mod config panel).

**Example browser_mod.popup call to display the card**
```yaml
action: browser_mod.popup
data:
  content:
    type: custom:set-timer-popup-card
    entity: switch_timer.toggle_fan
    title: Title
  size: classic
  allow_nested_more_info: true
  right_button: יציאה
  right_button_variant: warning
  right_button_appearance: filled
