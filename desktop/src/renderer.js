(() => {
  const form = document.querySelector('#alarmForm');
  const timeInput = document.querySelector('#alarmTime');
  const zoneSelect = document.querySelector('#timeZone');
  const status = document.querySelector('#status');
  const loginCheckbox = document.querySelector('#launchAtLogin');
  const dot = document.querySelector('#dot');
  const badgeText = document.querySelector('#badgeText');
  const list = document.querySelector('#alarmList');
  const count = document.querySelector('#alarmCount');
  const addButton = document.querySelector('#addButton');
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let alarms = [];
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'];
  const uniqueZones = [...new Set(['UTC', localZone, ...zones])].sort((a, b) => a === localZone ? -1 : b === localZone ? 1 : a.localeCompare(b));
  for (const zone of uniqueZones) { const option = document.createElement('option'); option.value = zone; option.textContent = zone === localZone ? `${zone} (this device)` : zone; zoneSelect.append(option); }
  zoneSelect.value = localZone;
  function formatAlarm(alarm) { return new Intl.DateTimeFormat(undefined, { timeZone: alarm.timeZone, weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(alarm.at)); }
  function render() {
    const ringing = alarms.some((alarm) => alarm.ringing);
    count.textContent = `(${alarms.length} of 5)`;
    addButton.disabled = alarms.length >= 5;
    addButton.textContent = alarms.length >= 5 ? 'All 5 alarms set' : 'Add alarm';
    dot.classList.toggle('active', alarms.some((alarm) => !alarm.ringing));
    list.innerHTML = alarms.map((alarm) => `<div class="alarm-item"><span><strong>${formatAlarm(alarm)}${alarm.ringing ? ' · Ringing' : ''}</strong><small>${alarm.timeZone}</small></span><button class="secondary" type="button" data-id="${alarm.id}">${alarm.ringing ? 'Dismiss' : 'Cancel'}</button></div>`).join('');
    if (ringing) { status.innerHTML = '<strong>An alarm is ringing.</strong><br>It will keep flashing until dismissed.'; badgeText.textContent = 'Alarm is ringing'; }
    else if (alarms.length) { status.innerHTML = `<strong>${alarms.length} alarm${alarms.length === 1 ? '' : 's'} set.</strong><br>The app will stay in the background if you minimize it.`; badgeText.textContent = `${alarms.length} alarm${alarms.length === 1 ? '' : 's'} armed`; }
    else { status.innerHTML = '<strong>No alarm set.</strong><br>Set a time to get started.'; badgeText.textContent = 'Waiting for an alarm'; }
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!timeInput.value || alarms.length >= 5) return;
    const [hour, minute] = timeInput.value.split(':').map(Number);
    try { alarms = await window.flashAlarm.setAlarm({ hour, minute, timeZone: zoneSelect.value }); render(); }
    catch (error) { status.innerHTML = `<strong>Could not set that alarm.</strong><br>${error.message}`; }
  });
  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-id]'); if (!button) return;
    alarms = await window.flashAlarm.cancelAlarm(button.dataset.id); render();
  });
  loginCheckbox.addEventListener('change', async () => {
    loginCheckbox.disabled = true;
    try { loginCheckbox.checked = await window.flashAlarm.setLaunchAtLogin(loginCheckbox.checked); }
    catch (_) { loginCheckbox.checked = false; status.innerHTML = '<strong>Could not change sign-in startup.</strong><br>Check your operating system settings and try again.'; }
    finally { loginCheckbox.disabled = false; }
  });
  window.flashAlarm.onAlarmChanged((next) => { alarms = next || []; render(); });
  window.flashAlarm.getState().then((state) => { alarms = state.alarms || (state.alarm ? [state.alarm] : []); loginCheckbox.checked = state.launchAtLogin; render(); }).catch(() => { status.innerHTML = '<strong>Could not load saved alarms.</strong><br>You can still set a new alarm.'; });
})();
