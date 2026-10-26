(() => {
  const form = document.querySelector('#alarmForm');
  const timeInput = document.querySelector('#alarmTime');
  const zoneSelect = document.querySelector('#timeZone');
  const status = document.querySelector('#status');
  const cancelButton = document.querySelector('#cancelButton');
  const loginCheckbox = document.querySelector('#launchAtLogin');
  const dot = document.querySelector('#dot');
  const badgeText = document.querySelector('#badgeText');
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let alarm = null;

  const zones = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'];
  const uniqueZones = [...new Set(['UTC', localZone, ...zones])];
  uniqueZones.sort((a, b) => a === localZone ? -1 : b === localZone ? 1 : a.localeCompare(b));
  for (const zone of uniqueZones) {
    const option = document.createElement('option');
    option.value = zone;
    option.textContent = zone === localZone ? `${zone} (this device)` : zone;
    zoneSelect.append(option);
  }
  zoneSelect.value = localZone;

  function formatAlarm(value) {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: value.timeZone,
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    }).format(new Date(value.at));
  }

  function render() {
    cancelButton.hidden = !alarm || alarm.ringing;
    dot.classList.toggle('active', Boolean(alarm));
    if (alarm?.ringing) {
      status.innerHTML = '<strong>Alarm is ringing.</strong><br>It will keep flashing until dismissed.';
      badgeText.textContent = 'Alarm is ringing';
    } else if (alarm) {
      status.innerHTML = `<strong>Alarm set for ${formatAlarm(alarm)}.</strong><br>The app will stay in the background if you minimize it.`;
      badgeText.textContent = 'Alarm is armed';
    } else {
      status.innerHTML = '<strong>No alarm set.</strong><br>Set a time to get started.';
      badgeText.textContent = 'Waiting for an alarm';
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!timeInput.value) return;
    const [hour, minute] = timeInput.value.split(':').map(Number);
    try {
      alarm = await window.flashAlarm.setAlarm({ hour, minute, timeZone: zoneSelect.value });
      render();
    } catch (error) {
      status.innerHTML = `<strong>Could not set that alarm.</strong><br>${error.message}`;
    }
  });

  cancelButton.addEventListener('click', async () => {
    alarm = await window.flashAlarm.cancelAlarm();
    render();
  });

  loginCheckbox.addEventListener('change', async () => {
    loginCheckbox.disabled = true;
    try {
      loginCheckbox.checked = await window.flashAlarm.setLaunchAtLogin(loginCheckbox.checked);
    } catch (_) {
      loginCheckbox.checked = false;
      status.innerHTML = '<strong>Could not change sign-in startup.</strong><br>Check your operating system settings and try again.';
    } finally {
      loginCheckbox.disabled = false;
    }
  });

  window.flashAlarm.onAlarmChanged((nextAlarm) => {
    alarm = nextAlarm;
    render();
  });

  window.flashAlarm.getState().then((state) => {
    alarm = state.alarm;
    loginCheckbox.checked = state.launchAtLogin;
    if (alarm && !alarm.ringing) {
      timeInput.value = `${String(alarm.hour).padStart(2, '0')}:${String(alarm.minute).padStart(2, '0')}`;
      zoneSelect.value = alarm.timeZone;
    }
    render();
  }).catch(() => {
    status.innerHTML = '<strong>Could not load saved alarm.</strong><br>You can still set a new alarm.';
  });
})();
