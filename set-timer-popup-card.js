// set-timer-popup-card.js
// RTL מלא + עמודות [שניות | דקות | שעות] + טווח 0..999 לכל עמודה + נרמול לפני שליחה

const LitElement = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class SetTimerCard extends LitElement {
  // --- חיבור ל-HA ---
  set hass(hass) {
    this._hass = hass;
    const prevState = this.entityState;
    this.entityState = this._hass?.states?.[this.entity]?.state;

    if (prevState !== this.entityState) {
      if (this.entityState === "set") {
        this._optimisticRunning = false;
        this._startIntervalUpdater();
      } else {
        this._optimisticRunning = false;
        this._stopIntervalUpdater();
        this._resetToZero();
      }
      this.requestUpdate();
    }
  }

  constructor() {
    super();

    // אינדקס 1 = "00" (שורה ריקה לפני)
    this.secondsColumnMoveIndex = 1;
    this.minutesColumnMoveIndex = 1;
    this.hoursColumnMoveIndex   = 1;

    // טווחים חדשים (בקשה שלך): 0..999 לכל עמודה
    this.maxSeconds = 999;
    this.maxMinutes = 999;
    this.maxHours   = 999;

    // הגבולות לאינדקסים (value+1, כי יש שורה ריקה בתחילת העמודה)
    this.secondsMaxMoveIndex = this.maxSeconds + 1;
    this.minutesMaxMoveIndex = this.maxMinutes + 1;
    this.hoursMaxMoveIndex   = this.maxHours   + 1;

    this.timerAction = "";
    this.focusedColumn = null;
    this.hoursChanged = false;
    this._optimisticRunning = false;

    // גיאומטריה
    this._digitHeight = null;
    this._centerOffset = null;
    this._lastWrapperHeight = null;
    this._lastDigitHeight = null;

    // RTL ברירת מחדל
    this._rtl = true;
  }

  // --- סגנון ---
  static styles = css`
    :host { direction: rtl; text-align: right; contain: content; }

    .set-timer-card{
      overflow: hidden;
      height: 100%;
      border-radius: 12px;
      direction: rtl;
      position: relative;
      padding: 12px 12px 0;
    }

    /* כפתור סגירה פנימי (בלי browser_mod style) */
    .close-inline {
      position: absolute;
      inset-inline-end: 10px;
      inset-block-start: 8px;
      font-size: 14px;
      opacity: .8;
      cursor: pointer;
      user-select: none;
    }

    .popup-title{
      font-weight: 700;
      text-decoration: underline;
      text-underline-offset: 4px;
      font-size: 18px;
      margin: 4px 0 6px;
      text-align: center;
      padding-inline: 24px;
    }

    .timer-input-card{
      display: flex;
      align-items: center;
      flex-direction: column;
      gap: 12px;
      border: none !important;
    }

    .timer-input-wrapper{
      display: flex;
      justify-content: center;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .dimmed{ opacity: 0.9; }
    .timer-setting-text{ font-size: 17px; }

    /* כותרות — סדר הפוך: שניות | דקות | שעות */
    .column-titles{
      display: flex;
      flex-direction: row-reverse;
      justify-content: center;
      gap: 40px;
      width: 100%;
      text-align: center;
    }
    .column-title{ width: 70px; font-family: Arial, sans-serif; }

    /* עמודות — גם פה הפוך: שניות | דקות | שעות */
    .timer-columns-wrapper{
      width: fit-content;
      display: flex;
      flex-direction: row-reverse;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin: 0 auto;
      direction: rtl;
    }

    /* המספרים עצמם LTR כדי להיות קריאים */
    .timer-digit-column-wrapper,
    .timer-digit-column,
    .timer-digit,
    .preview-time{ direction: ltr; }

    .timer-digit-column-wrapper{
      height: 80px;
      padding: 0 2px;
      mask-image: linear-gradient(
        to bottom,
        rgba(0,0,0,0) 0%,
        rgba(0,0,0,1) 8%,
        rgba(0,0,0,1) 92%,
        rgba(0,0,0,0) 100%
      );
      z-index: 2;
    }

    .timer-digit-column{
      display: flex;
      flex-direction: column;
      height: 130px;
      font-size: 36px;
      font-family: Arial, sans-serif;
      transition: transform 100ms ease;
      will-change: transform;
    }

    .timer-digit{
      text-align: center;
      min-width: 85px;
      min-height: 65px;
      line-height: 40px;
    }

    .digit-seperator{
      width: 2px;
      height: 60px;
      background-color: var(--primary-text-color);
      opacity: 0.9;
    }

    .preview-time{
      margin-top: 6px;
      font-family: monospace;
      text-align: center;
    }

    .timer-action-selector{
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      z-index: 5;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    .timer-action{ padding: 4px 10px; border-radius: 16px; cursor: default; }
    .pointer-cursor{ cursor: pointer; }
    .timer-action-active{
      color: var(--primary-background-color);
      background-color: var(--primary-text-color);
      border-radius: 17px;
    }

    .set-timer-button{
      display: block;
      padding: 10px 16px;
      margin: 16px auto 8px;
      background-color: rgb(13, 255, 0);
      color: #fff;
      border: none;
      border-radius: 6px;
      z-index: 5;
      cursor: pointer;
      font-size: 16px;
    }
  `;

  // --- רינדור ---
  render() {
    if (!this.entity) {
      return html`
        <ha-card class="set-timer-card">
          <div class="close-inline" @click=${this._closePopup}>סגור</div>
          <div class="timer-card-wrapper">
            <div class="card-content timer-input-card">
              ${ this.cardTitle ? html`<div class="popup-title">${this.cardTitle}</div>` : "" }
              <div style="opacity:.7;padding:8px">לא הוגדרה ישות</div>
            </div>
          </div>
        </ha-card>
      `;
    }

    const currentAction = this._hass?.states?.[this.entity]?.attributes?.action;
    const actionClassList = (this.entityState === "set") ? "timer-action" : "timer-action pointer-cursor";

    return html`
      <ha-card class="set-timer-card">
        <div class="close-inline" @click=${this._closePopup}>סגור</div>

        <div class="timer-card-wrapper">
          <div class="card-content timer-input-card">
            <div class="timer-input-wrapper ${this.entityState == "set" ? "dimmed" : ""}">
              ${ this.cardTitle ? html`<div class="popup-title">${this.cardTitle}</div>` : "" }

              <div class="column-titles">
                <span class="column-title">שניות</span>
                <span class="column-title">דקות</span>
                <span class="column-title">שעות</span>
              </div>

              <div class="timer-columns-wrapper">
                ${this._renderColumn("seconds-column", this.maxSeconds)}
                <div class="digit-seperator"></div>
                ${this._renderColumn("minutes-column", this.maxMinutes)}
                <div class="digit-seperator"></div>
                ${this._renderColumn("hours-column", this.maxHours)}
              </div>

              <div class="preview-time">${this._previewDuration()}</div>
            </div>
          </div>

          ${ this._showActions() ? html`
            <div class="timer-action-selector ${this.entityState == "set" ? "dimmed" : ""}">
              <span class="${actionClassList} ${currentAction === "turn_on" ? "timer-action-active" : ""}"
                    id="turn_on" @click="${this._setTimerAction}" @touchstart="${this._setTimerAction}">הפעלה</span>
              <span class="${actionClassList} ${currentAction === "turn_off" ? "timer-action-active" : ""}"
                    id="turn_off" @click="${this._setTimerAction}">כיבוי</span>
              <span class="${actionClassList} ${currentAction === "toggle" ? "timer-action-active" : ""}"
                    id="toggle" @click="${this._setTimerAction}">החלפה</span>
            </div>
          ` : "" }

          <button class="set-timer-button" @click="${this._submitAction}">
            ${this.entityState == "idle" ? "אישור" : "ביטול טיימר"}
          </button>
        </div>
      </ha-card>
    `;
  }

  // --- לוגיקת עדכון מיקום ספרות ---
  updated() {
    this._moveTimerColumn(this.hoursColumnMoveIndex, "hours-column");
    this._moveTimerColumn(this.minutesColumnMoveIndex, "minutes-column");
    this._moveTimerColumn(this.secondsColumnMoveIndex, "seconds-column");
  }

  _showActions() { return this.entityState !== "set" && !this._optimisticRunning; }

  _renderColumn(id, maxValue) {
    // מייצר: [ריק] + 0..maxValue (כלומר 0..999 כברירת מחדל)
    return html`
      <div class="timer-digit-column-wrapper" id="${id}"
           @touchstart="${this._handleTouchStart}"
           @touchmove="${this._handleTouchMove}"
           @wheel="${this._handleScroll}"
           @mousedown="${this._focusColumn}"
           @click="${this._focusColumn}">
        <div class="timer-digit-column">
          <div class="timer-digit"></div>
          ${Array.from({length:maxValue+1}, (_,i)=>html`<div class="timer-digit">${String(i).padStart(2,"0")}</div>`)}
        </div>
      </div>
    `;
  }

  _focusColumn = (e) => {
    this.focusedColumn = e.currentTarget.id;
    this.requestUpdate();
  };

  _handleTouchStart(event) {
    event.preventDefault();
    const touch = event.touches[0];
    this.startY = touch.clientY;
    this.lastMoveDeltaY = 0;
    this.focusedColumn = event.currentTarget.id;
    this.requestUpdate();
  }

  _handleTouchMove(event) {
    event.preventDefault();
    if (this.entityState == "idle") {
      const touch = event.changedTouches[0];
      const endY = touch.clientY;
      const deltaY = this.startY - endY;
      const scrollDirectionUpward = deltaY > 0;
      if (Math.abs(deltaY) - this.lastMoveDeltaY >= 20) {
        this.swipeColumn(scrollDirectionUpward, event.currentTarget.id);
        this.lastMoveDeltaY = Math.abs(deltaY);
      }
    }
  }

  _handleScroll(event) {
    if (this.entityState == "idle") {
      const columnWrapperId = event.currentTarget.id;
      event.preventDefault();
      this.focusedColumn = columnWrapperId;
      const indexChange = event.deltaY > 0 ? 1 : event.deltaY < 0 ? -1 : 0;

      let maxIdx, newIndex;
      switch (columnWrapperId) {
        case "hours-column":
          maxIdx = this.hoursMaxMoveIndex;
          newIndex = this.hoursColumnMoveIndex + indexChange;
          this.hoursColumnMoveIndex = Math.max(1, Math.min(maxIdx, newIndex));
          this.hoursChanged = this.hoursColumnMoveIndex > 1;
          break;
        case "minutes-column":
          maxIdx = this.minutesMaxMoveIndex;
          newIndex = this.minutesColumnMoveIndex + indexChange;
          this.minutesColumnMoveIndex = Math.max(1, Math.min(maxIdx, newIndex));
          break;
        case "seconds-column":
          maxIdx = this.secondsMaxMoveIndex;
          newIndex = this.secondsColumnMoveIndex + indexChange;
          this.secondsColumnMoveIndex = Math.max(1, Math.min(maxIdx, newIndex));
          break;
      }
      this.requestUpdate();
    }
  }

  swipeColumn(upwardDirection, columnWrapperId) {
    const indexChange = upwardDirection ? 1 : -1;
    let maxIdx, newIndex;
    switch (columnWrapperId) {
      case "hours-column":
        maxIdx = this.hoursMaxMoveIndex;
        newIndex = this.hoursColumnMoveIndex + indexChange;
        this.hoursColumnMoveIndex = Math.max(1, Math.min(maxIdx, newIndex));
        this.hoursChanged = this.hoursColumnMoveIndex > 1;
        break;
      case "minutes-column":
        maxIdx = this.minutesMaxMoveIndex;
        newIndex = this.minutesColumnMoveIndex + indexChange;
        this.minutesColumnMoveIndex = Math.max(1, Math.min(maxIdx, newIndex));
        break;
      case "seconds-column":
        maxIdx = this.secondsMaxMoveIndex;
        newIndex = this.secondsColumnMoveIndex + indexChange;
        this.secondsColumnMoveIndex = Math.max(1, Math.min(maxIdx, newIndex));
        break;
    }
    this.requestUpdate();
  }

  // ---- יישור מרכזי דינמי ----
  _ensureGeometry(wrapper, column) {
    const sample = column.querySelector('.timer-digit:nth-child(2)') || column.querySelector('.timer-digit');
    const wrapperH = wrapper ? wrapper.clientHeight : 130;
    const digitH = sample ? sample.clientHeight : 55;

    if (this._lastWrapperHeight !== wrapperH || this._lastDigitHeight !== digitH) {
      this._lastWrapperHeight = wrapperH;
      this._lastDigitHeight = digitH;
      this._digitHeight = digitH;
      this._centerOffset = (wrapperH - digitH) / 2;
    }
  }

  _moveTimerColumn(columnMoveIndex, columnWrapperId) {
    const root = this.renderRoot || this.shadowRoot;
    if (!root) return;
    const wrapper = root.querySelector(`#${columnWrapperId}`);
    if (!wrapper) return;
    const column = wrapper.querySelector('.timer-digit-column');
    if (!column) return;

    this._ensureGeometry(wrapper, column);
    const digitH = this._digitHeight ?? 55;
    const offset = this._centerOffset ?? 0;
    const y = -(columnMoveIndex * digitH) + offset;
    column.style.transform = `translateY(${y}px)`;
  }

  // --- אינטרוולים ---
  _startIntervalUpdater() {
    if (this.timerUpdateInterval) window.clearInterval(this.timerUpdateInterval);
    this.timerUpdateInterval = window.setInterval(() => {
      const finishingAt = this._hass?.states?.[this.entity]?.attributes?.finishing_at;
      this._updateRemaningTime(finishingAt);
    }, 500);
  }
  _stopIntervalUpdater() {
    if (this.timerUpdateInterval) {
      window.clearInterval(this.timerUpdateInterval);
      this.timerUpdateInterval = null;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (this._rtl) this.setAttribute('dir', 'rtl');
    this._resetToZero();
    if (this.entityState == "set") this._startIntervalUpdater();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopIntervalUpdater();
  }

  _resetToZero() {
    this.hoursColumnMoveIndex = 1;
    this.minutesColumnMoveIndex = 1;
    this.secondsColumnMoveIndex = 1;
  }

  // --- זמן נותר ---
  _updateRemaningTime(finishingAt) {
    if (!finishingAt || this.entityState !== "set") return;

    const finishingTime = new Date(finishingAt);
    const remainingMs = finishingTime - new Date();
    if (remainingMs <= 0) { this._resetToZero(); return; }

    const remainingH = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingM = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const remainingS = Math.floor((remainingMs % (1000 * 60)) / 1000);

    this.hoursColumnMoveIndex   = (remainingH === 0) ? 1 : Math.min(this.hoursMaxMoveIndex,   remainingH + 1);
    this.minutesColumnMoveIndex = (remainingM === 0) ? 1 : Math.min(this.minutesMaxMoveIndex, remainingM + 1);
    this.secondsColumnMoveIndex = (remainingS === 0) ? 1 : Math.min(this.secondsMaxMoveIndex, remainingS + 1);

    this.hoursChanged = this.hoursColumnMoveIndex > 1;
    this.requestUpdate();
  }

  // --- פעולות ---
  _setTimerAction(clickEvent) {
    if (this.entityState == "idle") {
      this.renderRoot?.querySelectorAll?.(".timer-action")?.forEach?.((b) => b.classList.remove("timer-action-active"));
      const button = clickEvent.currentTarget;
      button.classList.add("timer-action-active");
      this.timerAction = button.id; // turn_on/turn_off/toggle
    }
  }

  _previewDuration() {
    const pad = (n) => String(n).padStart(2, "0");
    const sVal = Math.max(0, this.secondsColumnMoveIndex - 1);
    const mVal = Math.max(0, this.minutesColumnMoveIndex - 1);
    const hVal = Math.max(0, this.hoursColumnMoveIndex   - 1);

    // מציגים כפי שנבחר (גם אם >59) — רק תצוגה
    return `${pad(hVal)}:${pad(mVal)}:${pad(sVal)}`;
  }

  _submitAction() {
    if (!this._hass) return;

    if (this.entityState == "idle") {
      const sRaw = Math.max(0, this.secondsColumnMoveIndex - 1);
      const mRaw = Math.max(0, this.minutesColumnMoveIndex - 1);
      const hRaw = Math.max(0, this.hoursColumnMoveIndex   - 1);

      // --- נרמול לפורמט HH:MM:SS תקני ---
      let totalSeconds = (hRaw * 3600) + (mRaw * 60) + sRaw;
      const h = Math.floor(totalSeconds / 3600);
      totalSeconds -= h * 3600;
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds - (m * 60);

      const pad2 = (n) => String(n).padStart(2, "0");

      const actionToSend =
        this.timerAction ||
        this._hass?.states?.[this.entity]?.attributes?.action ||
        "toggle";

      this._optimisticRunning = true;
      this.requestUpdate();

      this._hass.callService("switch_timer", "set_timer", {
        entity_id: this.entity,
        action: actionToSend,
        duration: `${pad2(h)}:${pad2(m)}:${pad2(s)}`, // HH:MM:SS אחרי נרמול
      });

      this._startIntervalUpdater();
      this.focusedColumn = null;
      setTimeout(() => this.requestUpdate(), 200);

    } else if (this.entityState == "set") {
      this._stopIntervalUpdater();
      this._hass.callService("switch_timer", "cancel_timer", { entity_id: this.entity });
      this._optimisticRunning = false;
      this._resetToZero();
      setTimeout(() => { this.requestUpdate(); }, 200);
    }
  }

  _closePopup = () => {
    // סוגר את הפופאפ בלי להסתמך על right_button של browser_mod
    const ev = new CustomEvent("browser-mod-action", {
      bubbles: true, composed: true,
      detail: { action: "close_popup" }
    });
    this.dispatchEvent(ev);
  };

  setConfig(config) {
    if (!config.entity) throw new Error("No timer entity supplied");
    if (!config.entity.startsWith("switch_timer.")) throw new Error("Not a valid 'switch_timer' entity");
    this.entity = config.entity;
    this.cardTitle = typeof config.title === "string" ? config.title : "";

    // אופציונלי: לקבוע טווחים אחרים
    if (Number.isInteger(config.max_hours))   { this.maxHours   = Math.max(0, config.max_hours); }
    if (Number.isInteger(config.max_minutes)) { this.maxMinutes = Math.max(0, config.max_minutes); }
    if (Number.isInteger(config.max_seconds)) { this.maxSeconds = Math.max(0, config.max_seconds); }

    this.hoursMaxMoveIndex   = this.maxHours   + 1;
    this.minutesMaxMoveIndex = this.maxMinutes + 1;
    this.secondsMaxMoveIndex = this.maxSeconds + 1;

    if (typeof config.rtl === "boolean") {
      this._rtl = config.rtl;
      if (this._rtl) this.setAttribute('dir', 'rtl'); else this.removeAttribute('dir');
    }
  }

  getCardSize() { return 3; }
}

if (!customElements.get("set-timer-popup-card")) {
  customElements.define("set-timer-popup-card", SetTimerCard);
}
