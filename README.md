# set-timer-popup-card

Lovelace card intended for use with [Switch timer](https://github.com/gh0stblizz4rd/ha-switch-timer) integration. Schedule a timer by using a [browser_mod](https://github.com/thomasloven/hass-browser_mod) popup.

<p>
    <img src="https://i.imgur.com/s3wWdru.png" width="500px"/>
</p>

This card is designed to be placed inside a [browser_mod](https://github.com/thomasloven/hass-browser_mod) popup. The card will close the popup after 500 milliseconds automatically when a timer is scheduled (Requires your browser to be registered in browser_mod config panel).

**Example browser_mod.popup call to display the card**
```
action: browser_mod.popup
data:
  title: Popup title
  target:
    device_id: this
  content:
    type: custom:set-timer-popup-card
    entity: switch_timer.sample_light
```
This popup service can be set as `hold_action` or `tap_action` for a frontend card.
<p>
	<img src="https://i.imgur.com/vzVXCSL.png">
</p>

<br></br>

### Installation using [HACS](https://hacs.xyz/)
1. Go to the main screen of HACS and select custom repositories option in the top right corner menu.
	<p>
		<img src="https://i.imgur.com/ILC0eOZ.png">
	</p>
2. Enter enter the URL of this repository, select type as Dashboard and click add.
	<p>
		<img src="	https://i.imgur.com/lTvs4S2.png">
	</p>
3. Search for set-timer-popup-card in HACS and download the card.
	<p>
		<img src="https://i.imgur.com/82Y8gb5.png">
	</p>
4. After downloading the card, make sure to click the reload button in the prompt. The card is ready to be used.
	<p>
		<img src="	https://i.imgur.com/7MsFnlb.png">
	</p>

Enjoy! ;)


## Issues & support
If you encounter any problems with the card, feel free to contact me by email romansa772@aol.com or open an issue in this repository. If you wish to support my work you can make a donation [here](https://paypal.me/romansaudzeris?country.x=LV&locale.x=en_US) or just give this repo a star.
