// set-timer-popup-card.js
// מבוסס על הכרטיס שלך + תיקון RTL מלא בתוך ה-Web Component

const LitElement = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class SetTimerCard extends LitElement {
  // --- HA → מפעיל/עוצר interval כשמצב הישות משתנה ---
  set hass(hass) {
    this._hass = hass;
    const prevState = this.entityState;
    this.entityState = this._hass?.states?.[this.entity]?.state;

    if (prevState !== this.entityState) {
      if (this.entityState === "set") {
        this._optimisticRunning = false;   // HA אישר שהטיימר רץ
        this._startIntervalUpdater();
      } else {
        this._optimisticRunning = false;   // חזרה ל-idle
        this._stopIntervalUpdater();
        this._resetToZero();               // רק מעדכן אינדקסים; ההזזה תקרה ב-updated()
      }
      this.requestUpdate();
    }
  }

  constructor() {
    super();
    // אינדקס 1 = "00" (יש שורה ריקה לפני)
    this.hoursColumnMoveIndex = 0;
    this.minutesColumnMoveIndex = 0;
    this.secondsColumnMoveIndex = 0;

    this.hoursMaxMoveIndex = 24;
    this.minutesMaxMoveIndex = 60;
    this.secondsMaxMoveIndex = 60;

    this.timerAction = "";
    this.focusedColumn = null;
    this.hoursChanged = false;       // עד שלא בחרו שעה > 00
    this._optimisticRunning = false; // הסתרת כפתורים מיד אחרי "הפעלת טיימר"

    // גיאומטריה דינמית ליישור מדויק
    this._digitHeight = null;
    this._centerOffset = null;
    this._lastWrapperHeight = null;
    this._lastDigitHeight = null;

    // RTL ברירת מחדל
    this._rtl = true;
  }

  static styles = css`
    :host {
      direction: rtl;            /* 👈 כיווניות ברירת מחדל */
      text-align: right;
      contain: content;          /* מונע דליפה עיצובית ל-DOM חיצוני */
    }

    .popup-title{
      font-weight: 700;
      text-decoration: underline;
      text-underline-offset: 4px;
      font-size: 18px;
      margin: 4px 0 6px;
      text-align: center;
      direction: rtl;
    }

    /* כרטיס */
    .set-timer-card{
      overflow: hidden;
      height: 100%;
      border-radius: 12px;
      direction: rtl;
    }

    /* מעטפת פנימית */
    .container ha-card{
      border: none !important;
      padding: 12px;
    }

    /* אזור הקלט */
    .timer-input-card{
      display: flex;
      align-items: center;
      flex-direction: column;
      gap: 15px;
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

    /* כותרות העמודות */
    .column-titles{
      display: flex;
      justify-content: center;
      gap: 54px;
      width: 100%;
      direction: rtl;
      text-align: center;
    }
    .column-title{
      width: 60px;
      font-family: Arial, sans-serif;
    }

    /* שלוש העמודות הגוללות */
    .timer-columns-wrapper{
      width: fit-content;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin: 0 auto;
      direction: ltr;            /* 👈 המספרים עצמם לוגית LTR */
    }

    .timer-digit-column-wrapper{
      /* חלון תצוגה בגובה קבוע */
      height: 80px;            /* ⚙️ גובה החלון */
      padding: 0 2px;
      /* ⚙️ מסכה רחבה יותר כדי שספרה שלמה תיראה מיד */
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
      height: 130px;            /* ⚙️ להתאים לחלון ↑ */
      font-size: 36px;
      font-family: Arial, sans-serif;
      transition: transform 100ms ease;
      will-change: transform;
    }

    .timer-digit{
      text-align: center;
      min-width: 85px;         /* רוחב עמודה */
      min-height: 65px;        /* ⚙️ גובה שורה */
      line-height: 40px;       /* ⚙️ */
    }

    .digit-seperator{
      width: 2px;
      height: 60px;            /* ⚙️ להתאים לחלון */
      background-color: var(--primary-text-color);
      opacity: 0.9;
    }

    /* כפתורי פעולה */
    .timer-action-selector{
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      z-index: 5;
      flex-wrap: wrap;
      margin-top: 12px;
      direction: rtl;           /* טקסטים בעברית */
    }
    .timer-action{
      padding: 4px 10px;
      border-radius: 16px;
      cursor: default;
    }
    .pointer-cursor{ cursor: pointer; }
    .timer-action-active{
      color: var(--primary-background-color);
      background-color: var(--primary-text-color);
      border-radius: 17px;
    }

    /* כפתור תחתון */
    .set-timer-button{
      display: block;
      padding: 10px 16px;
      margin: 16px auto 0;
      background-color: rgb(13, 255, 0);
      color: #fff;
      border: none;
      border-radius: 6px;
      z-index: 5;
      cursor: pointer;
      font-size: 16px;
      direction: rtl;
    }

    /* תצוגת זמן מקדימה */
    .preview-time{
      margin-top: 6px;
      font-family: monospace;
      direction: ltr;           /* שמירת פורמט HH:MM:SS קריא */
      text-align: center;
    }
  `;

  // --- רינדור הכרטיס ---
  render() {
    if (!this.entity) {
      // אם משום מה לא הוגדרה ישות – עדיין מציגים שלד, כדי שהפופאפ לא יהיה ריק
      return html`
        <ha-card class="set-timer-card">
          <div class="timer-card-wrapper">
            <div class="card-content timer-input-card">
              <div class="timer-input-wrapper">
                ${ this.cardTitle ? html`<div class="popup-title">${this.cardTitle}</div>` : "" }
                <div style="opacity:.7;padding:8px">לא הוגדרה ישות</div>
              </div>
            </div>
          </div>
        </ha-card>
      `;
    }

    const currentAction = this._hass?.states?.[this.entity]?.attributes?.action;
    const actionClassList = (this.entityState === "set") ? "timer-action" : "timer-action pointer-cursor";

    return html`
      <ha-card class="set-timer-card">
        <div class="timer-card-wrapper">
          <div class="card-content timer-input-card">
            <div class="timer-input-wrapper ${this.entityState == "set" ? "dimmed" : ""}">
              ${ this.cardTitle ? html`<div class="popup-title">${this.cardTitle}</div>` : "" }

              <span class="timer-setting-text"></span>
              <div class="column-titles">
                <span class="column-title ${this.entityState === 'idle' && this.focusedColumn === 'hours-column' ? 'focused' : ''}">שעות</span>
                <span class="column-title ${this.entityState === 'idle' && this.focusedColumn === 'minutes-column' ? 'focused' : ''}">דקות</span>
                <span class="column-title ${this.entityState === 'idle' && this.focusedColumn === 'seconds-column' ? 'focused' : ''}">שניות</span>
              </div>
              <div class="timer-columns-wrapper">
                ${this._renderColumn("hours-column", 24)}
                <div class="digit-seperator"></div>
                ${this._renderColumn("minutes-column", 60)}
                <div class="digit-seperator"></div>
                ${this._renderColumn("seconds-column", 60)}
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

  // --- הזזת עמודות רק אחרי רינדור! ---
  updated() {
    // אחרי כל עדכון, יישר את שלושת העמודות למרכז לפי האינדקסים הנוכחיים
    this._moveTimerColumn(this.hoursColumnMoveIndex, "hours-column");
    this._moveTimerColumn(this.minutesColumnMoveIndex, "minutes-column");
    this._moveTimerColumn(this.secondsColumnMoveIndex, "seconds-column");
  }

  _showActions() {
    // מציגים את כפתורי הפעולה רק כשהטיימר לא רץ, וגם לא במצב אופטימי בדיוק אחרי הפעלה
    return this.entityState !== "set" && !this._optimisticRunning;
  }

  _renderColumn(id, max) {
    return html`
      <div class="timer-digit-column-wrapper" id="${id}"
           @touchstart="${this._handleTouchStart}"
           @touchmove="${this._handleTouchMove}"
           @wheel="${this._handleScroll}"
           @mousedown="${this._focusColumn}"
           @click="${this._focusColumn}">
        <div class="timer-digit-column">
          <div class="timer-digit"></div>
          ${Array.from({length:max}, (_,i)=>html`<div class="timer-digit">${String(i).padStart(2,"0")}</div>`)}
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

  // --- ניהול interval חי ---
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
    // נצמיד RTL ל-host כדי שלא נירש LTR מהדיאלוג של browser_mod
    if (this._rtl) this.setAttribute('dir', 'rtl');
    this._resetToZero(); // רק אינדקסים; ההזזה תיעשה ב-updated()
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

  // --- חישוב זמן שנותר ---
  _updateRemaningTime(finishingAt) {
    if (!finishingAt || this.entityState !== "set") return;

    const finishingTime = new Date(finishingAt);
    const remainingMs = finishingTime - new Date();
    if (remainingMs <= 0) {
      this._resetToZero();
      return;
    }

    const remainingH = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingM = Math.floor(remainingMs / (1000 * 60));
    const remainingS = Math.floor(remainingMs / 1000);

    const mm = remainingM - remainingH * 60;
    const ss = remainingS - remainingM * 60;

    // 0 -> index 1 (00), אחרת value+1
    this.hoursColumnMoveIndex   = (remainingH === 0) ? 1 : remainingH + 1;
    this.minutesColumnMoveIndex = (mm === 0)        ? 1 : mm + 1;
    this.secondsColumnMoveIndex = (ss === 0)        ? 1 : ss + 1;

    this.hoursChanged = this.hoursColumnMoveIndex > 1;
    this.requestUpdate();
  }

  _handleScroll(event) {
    if (this.entityState == "idle") {
      const columnWrapperId = event.currentTarget.id;
      event.preventDefault();
      this.focusedColumn = columnWrapperId;
      const indexChange = event.deltaY > 0 ? 1 : event.deltaY < 0 ? -1 : 0;

      let newIndex;
      switch (columnWrapperId) {
        case "hours-column": {
          newIndex = this.hoursColumnMoveIndex + indexChange;
          if (!this.hoursChanged && newIndex <= 1) {
            this.hoursColumnMoveIndex = 1;
            break;
          }
          if (newIndex < this.hoursMaxMoveIndex && newIndex >= 1) {
            this.hoursColumnMoveIndex = newIndex;
            this.hoursChanged = this.hoursColumnMoveIndex > 1;
          }
          break;
        }
        case "minutes-column":
          newIndex = this.minutesColumnMoveIndex + indexChange;
          if (newIndex < this.minutesMaxMoveIndex && newIndex >= 1) {
            this.minutesColumnMoveIndex = newIndex;
          }
          break;
        case "seconds-column":
          newIndex = this.secondsColumnMoveIndex + indexChange;
          if (newIndex < this.secondsMaxMoveIndex && newIndex >= 1) {
            this.secondsColumnMoveIndex = newIndex;
          }
          break;
      }
      this.requestUpdate();
    }
  }

  swipeColumn(upwardDirection, columnWrapperId) {
    const indexChange = upwardDirection ? 1 : -1;
    let newIndex;
    switch (columnWrapperId) {
      case "hours-column": {
        newIndex = this.hoursColumnMoveIndex + indexChange;
        if (!this.hoursChanged && newIndex <= 1) {
          this.hoursColumnMoveIndex = 1; // נעילה על 00
          break;
        }
        if (newIndex < this.hoursMaxMoveIndex && newIndex >= 1) {
          this.hoursColumnMoveIndex = newIndex;
          this.hoursChanged = this.hoursColumnMoveIndex > 1;
        }
        break;
      }
      case "minutes-column":
        newIndex = this.minutesColumnMoveIndex + indexChange;
        if (newIndex < this.minutesMaxMoveIndex && newIndex >= 1) {
          this.minutesColumnMoveIndex = newIndex;
        }
        break;
      case "seconds-column":
        newIndex = this.secondsColumnMoveIndex + indexChange;
        if (newIndex < this.secondsMaxMoveIndex && newIndex >= 1) {
          this.secondsColumnMoveIndex = newIndex;
        }
        break;
    }
    this.requestUpdate();
  }

  // ---- יישור מדויק: חישוב Offset מרכזי דינמי ----
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
    if (!root) return; // עדיין לא רונדר – נוותר, updated יקרא שוב
    const wrapper = root.querySelector(`#${columnWrapperId}`);
    if (!wrapper) return;
    const column = wrapper.querySelector('.timer-digit-column');
    if (!column) return;

    this._ensureGeometry(wrapper, column);

    const digitH = this._digitHeight ?? 55;
    const offset = this._centerOffset ?? 0;
    const y = -(columnMoveIndex * digitH) + offset; // מרכז את הערך הנבחר
    column.style.transform = `translateY(${y}px)`;
  }
  // ------------------------------------------------

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
    const hVal = this.hoursChanged ? Math.max(0, this.hoursColumnMoveIndex - 1) : 0;
    const mVal = Math.max(0, this.minutesColumnMoveIndex - 1);
    const sVal = Math.max(0, this.secondsColumnMoveIndex - 1);
    return `${pad(hVal)}:${pad(mVal)}:${pad(sVal)}`;
  }

  _submitAction() {
    if (this.entityState == "idle") {
      const pad = (n) => String(n).padStart(2, "0");
      const hVal = this.hoursChanged ? Math.max(0, this.hoursColumnMoveIndex - 1) : 0;
      const mVal = Math.max(0, this.minutesColumnMoveIndex - 1);
      const sVal = Math.max(0, this.secondsColumnMoveIndex - 1);
      const actionToSend = this.timerAction || this._hass?.states?.[this.entity]?.attributes?.action || "toggle";

      this._optimisticRunning = true; // הסתר כפתורים מיידית
      this.requestUpdate();

      this._hass.callService("switch_timer", "set_timer", {
        entity_id: this.entity,
        action: actionToSend,
        duration: `${pad(hVal)}:${pad(mVal)}:${pad(sVal)}`, // HH:MM:SS
      });

      this._startIntervalUpdater();
      this.focusedColumn = null;
      setTimeout(() => this.requestUpdate(), 200);
    } else if (this.entityState == "set") {
      this._stopIntervalUpdater();
      this._hass.callService("switch_timer", "cancel_timer", { entity_id: this.entity });
      this._optimisticRunning = false; // החזרת הכפתורים
      this._resetToZero();
      setTimeout(() => { this.requestUpdate(); }, 200);
    }
  }

  setConfig(config) {
    if (!config.entity) throw new Error("No timer entity supplied");
    if (!config.entity.startsWith("switch_timer.")) throw new Error("The supplied entity is not a valid 'switch_timer' entity");
    this.entity = config.entity;
    this.cardTitle = typeof config.title === "string" ? config.title : "";
    // שליטה אופציונלית ברמת הקונפיג
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
