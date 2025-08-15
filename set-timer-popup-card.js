const LitElement = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class SetTimerCard extends LitElement {
  set hass(hass) {
    this._hass = hass;
    this.entityState = this._hass.states[this.entity].state;
  }

  constructor() {
    super();
    this.hoursColumnMoveIndex = 0;
    this.minutesColumnMoveIndex = 0;
    this.secondsColumnMoveIndex = 0;
    this.hoursMaxMoveIndex = 24;
    this.minutesMaxMoveIndex = 60;
    this.secondsMaxMoveIndex = 60;
    this.timerAction = "";
  }

  static styles = css`
    .set-timer-card {
      overflow: hidden;
      height: 100%;
    }

    .container ha-card {
      border: none !important;
      padding: 12px;
    }

    .timer-input-card {
      display: flex;
      align-items: center;
      flex-direction: column;
      gap: 15px;
      border: none !important;
    }

    .timer-input-wrapper {
      display: flex;
      justify-content: center;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .dimmed {
      opacity: 0.9;
    }

    .timer-setting-text {
      font-size: 17px;
    }

    .column-titles {
      display: flex;
    }

    .column-title {
      width: 90px;
      text-align: center;
      font-family: Arial, sans-serif;
    }

    .timer-columns-wrapper {
      width: fit-content;
      display: flex;
      align-items: center;
    }

    .timer-digit-column-wrapper {
      mask-image: linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0),
        rgba(0, 0, 0, 1) 40%,
        rgba(0, 0, 0, 1) 60%,
        rgba(0, 0, 0, 0)
      );
      z-index: 2;
    }

    .timer-digit-column {
      display: flex;
      flex-direction: column;
      height: 130px;
      font-size: 40px;
      font-family: Arial, sans-serif;
      transition: transform 100ms ease;
    }

    .timer-digit {
      text-align: center;
      min-width: 85px;
      min-height: 55px;
    }

    .digit-seperator {
      width: 4px;
      height: 130px;
      background-color: var(--primary-text-color);
    }

    .timer-action-selector {
      display: flex;
      align-items: center;
      z-index: 5;
      gap: 8px;
    }

    .timer-action {
      padding: 4px 6px;
    }

    .pointer-cursor {
      cursor: pointer;
    }

    .timer-action-active {
      color: var(--primary-background-color);
      background-color: var(--primary-text-color);
      border-radius: 17px;
    }
    .set-timer-button {
      padding: 10px 16px;
      background-color: var(--primary-color);
      color: white;
      border: none;
      border-radius: 4px;
      z-index: 5;
      cursor: pointer;
      font-size: 1rem;
    }
  `;

  render() {
    let actionClassList;
    if (this.entityState == "set") actionClassList = "timer-action";
    else if (this.entityState == "idle") actionClassList = "timer-action pointer-cursor";

    return html`
      <ha-card class="set-timer-card">
        <div class="timer-card-wrapper">
          <div class="card-content timer-input-card">
            <div class="timer-input-wrapper ${this.entityState == "set" ? "dimmed" : ""}">
              <span class="timer-setting-text"></span>
              <div class="column-titles">
                <span class="column-title">Hours</span>
                <span class="column-title">Minutes</span>
                <span class="column-title">Seconds</span>
              </div>
              <div class="timer-columns-wrapper">
                ${this._renderColumn("hours-column", 24)}
                <div class="digit-seperator"></div>
                ${this._renderColumn("minutes-column", 60)}
                <div class="digit-seperator"></div>
                ${this._renderColumn("seconds-column", 60)}
              </div>
            </div>
          </div>

          <div class="timer-action-selector ${this.entityState == "set" ? "dimmed" : ""}">
            <span class="${actionClassList} ${this._hass.states[this.entity].attributes.action == "turn_on" ? "timer-action-active" : ""}"
                  id="turn_on" @click="${this._setTimerAction}" @touchstart="${this._setTimerAction}">Turn on</span>
            <span class="${actionClassList} ${this._hass.states[this.entity].attributes.action == "turn_off" ? "timer-action-active" : ""}"
                  id="turn_off" @click="${this._setTimerAction}">Turn off</span>
            <span class="${actionClassList} ${this._hass.states[this.entity].attributes.action == "toggle" ? "timer-action-active" : ""}"
                  id="toggle" @click="${this._setTimerAction}">Toggle</span>
          </div>

          <button class="set-timer-button" @click="${this._submitAction}">
            ${this.entityState == "idle" ? "Set timer" : "Cancel timer"}
          </button>
        </div>
      </ha-card>
    `;
  }

  _renderColumn(id, max) {
    return html`
      <div class="timer-digit-column-wrapper" id="${id}"
           @touchstart="${this._handleTouchStart}"
           @touchmove="${this._handleTouchMove}"
           @wheel="${this._handleScroll}">
        <div class="timer-digit-column">
          <div class="timer-digit"></div>
          ${Array.from({length:max}, (_,i)=>html`<div class="timer-digit">${String(i).padStart(2,"0")}</div>`)}
        </div>
      </div>
    `;
  }

  _setTimerAction(clickEvent) {
    if (this.entityState == "idle") {
      this.renderRoot.querySelectorAll(".timer-action").forEach((b) => b.classList.remove("timer-action-active"));
      const button = clickEvent.currentTarget;
      button.classList.add("timer-action-active");
      this.timerAction = button.id; // שולח ערכים חוקיים
    }
  }

  _submitAction() {
    if (this.entityState == "idle") {
      const pad = (n) => String(n).padStart(2, "0");
      const hVal = Math.max(0, this.hoursColumnMoveIndex - 1);
      const mVal = Math.max(0, this.minutesColumnMoveIndex - 1);
      const sVal = Math.max(0, this.secondsColumnMoveIndex - 1);
      const actionToSend = this.timerAction || this._hass.states[this.entity]?.attributes?.action || "toggle";

      this._hass.callService("switch_timer", "set_timer", {
        entity_id: this.entity,
        action: actionToSend,
        duration: `${pad(hVal)}:${pad(mVal)}:${pad(sVal)}`,
      });

      setTimeout(() => { this.requestUpdate(); this._startIntervalUpdater(); }, 200);
      setTimeout(() => { this._hass.callService("browser_mod", "close_popup", { target: "this" }); }, 1500);
    } else if (this.entityState == "set") {
      this._stopIntervalUpdater();
      this._hass.callService("switch_timer", "cancel_timer", { entity_id: this.entity });
      this.hoursColumnMoveIndex = 0;
      this.minutesColumnMoveIndex = 0;
      this.secondsColumnMoveIndex = 0;
      this._moveTimerColumn(this.hoursColumnMoveIndex, "hours-column");
      this._moveTimerColumn(this.minutesColumnMoveIndex, "minutes-column");
      this._moveTimerColumn(this.secondsColumnMoveIndex, "seconds-column");
      setTimeout(() => { this.requestUpdate(); }, 200);
    }
  }

  // ... שאר הפונקציות נשארו זהות חוץ מהתאמות אינדקסים ב־_updateRemaningTime
  _updateRemaningTime(finishingAt) {
    const finishingTime = new Date(finishingAt);
    const remainingMs = finishingTime - new Date();
    const remainingH = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingM = Math.floor(remainingMs / (1000 * 60));
    const remainingS = Math.floor(remainingMs / 1000);
    const remainingTime = [remainingH, remainingM - remainingH * 60, remainingS - remainingM * 60];

    if (this.entityState == "idle") {
      this._stopIntervalUpdater();
      this.hoursColumnMoveIndex = 0;
      this.minutesColumnMoveIndex = 0;
      this.secondsColumnMoveIndex = 0;
      this._moveTimerColumn(this.hoursColumnMoveIndex, "hours-column");
      this._moveTimerColumn(this.minutesColumnMoveIndex, "minutes-column");
      this._moveTimerColumn(this.secondsColumnMoveIndex, "seconds-column");
      this.requestUpdate();
      return null;
    }

    this.hoursColumnMoveIndex   = remainingTime[0] + 1;
    this.minutesColumnMoveIndex = remainingTime[1] + 1;
    this.secondsColumnMoveIndex = remainingTime[2] + 1;

    this._moveTimerColumn(this.hoursColumnMoveIndex, "hours-column");
    this._moveTimerColumn(this.minutesColumnMoveIndex, "minutes-column");
    this._moveTimerColumn(this.secondsColumnMoveIndex, "seconds-column");
  }

  setConfig(config) {
    if (!config.entity) throw new Error("No timer entity supplied");
    else if (!config.entity.startsWith("switch_timer.")) throw new Error("The supplied entity is not a valid 'switch_timer' entity");
    this.entity = config.entity;
  }

  getCardSize() { return 3; }
}

customElements.define("set-timer-popup-card", SetTimerCard);
