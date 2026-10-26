(() => {
  const timeLabel = document.querySelector('#alarmTime');
  document.querySelector('#dismissButton').addEventListener('click', () => window.flashAlarm.dismissAlarm());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') window.flashAlarm.dismissAlarm();
  });
  window.flashAlarm.onRing((payload) => {
    timeLabel.textContent = `Your alarm is ringing (${payload.time}).`;
    document.querySelector('#dismissButton').focus();
  });
})();
