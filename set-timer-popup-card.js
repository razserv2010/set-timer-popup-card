_updateRemaningTime(finishingAt) {
  if (!finishingAt || this.entityState !== "set") return;

  const finishingTime = new Date(finishingAt);
  const remainingMs = finishingTime - new Date();   // << היה theRemainingMs (באג)
  if (remainingMs <= 0) {
    // נגמר – נאפס תצוגה; ה-hass setter יעצור interval כשיעבור ל-idle
    this.hoursColumnMoveIndex = 1;
    this.minutesColumnMoveIndex = 1;
    this.secondsColumnMoveIndex = 1;
    this._moveTimerColumn(this.hoursColumnMoveIndex, "hours-column");
    this._moveTimerColumn(this.minutesColumnMoveIndex, "minutes-column");
    this._moveTimerColumn(this.secondsColumnMoveIndex, "seconds-column");
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

  this._moveTimerColumn(this.hoursColumnMoveIndex, "hours-column");
  this._moveTimerColumn(this.minutesColumnMoveIndex, "minutes-column");
  this._moveTimerColumn(this.secondsColumnMoveIndex, "seconds-column");
}
