const { app, BrowserWindow, Menu, Notification, ipcMain, screen, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const APP_ID = 'com.jhurdich.flashalarm';
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) app.quit();

let mainWindow = null;
let activeAlarm = null;
let overlayWindows = [];
let checkTimer = null;
let beepTimer = null;
let ringing = false;
let quitRequested = false;
const stateFile = () => path.join(app.getPath('userData'), 'alarm.json');

function getDatePartsInZone(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(new Date(timestamp));
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

function zonedTimeToTimestamp(year, month, day, hour, minute, timeZone) {
  const target = { year, month, day, hour, minute, second: 0 };
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23'
  });
  let candidate = targetAsUtc;
  for (let i = 0; i < 4; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(candidate)).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
    const actualAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    candidate += targetAsUtc - actualAsUtc;
  }
  const check = Object.fromEntries(formatter.formatToParts(new Date(candidate)).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  if (check.year !== target.year || check.month !== target.month || check.day !== target.day || check.hour !== target.hour || check.minute !== target.minute) {
    throw new Error('That time does not exist in this time zone because of a daylight saving time change. Choose another time.');
  }
  return candidate;
}

function createNextAlarm({ hour, minute, timeZone }) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error('Choose a valid alarm time.');
  }
  if (typeof timeZone !== 'string' || timeZone.length > 100) throw new Error('Choose a valid time zone.');

  const now = Date.now();
  let date = getDatePartsInZone(now, timeZone);
  let at = zonedTimeToTimestamp(date.year, date.month, date.day, hour, minute, timeZone);
  if (at <= now) {
    const tomorrow = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
    date = { year: tomorrow.getUTCFullYear(), month: tomorrow.getUTCMonth() + 1, day: tomorrow.getUTCDate() };
    at = zonedTimeToTimestamp(date.year, date.month, date.day, hour, minute, timeZone);
  }
  return { at, timeZone, hour, minute };
}

function persistAlarm() {
  const file = stateFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tempFile = `${file}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify({ alarm: activeAlarm }), 'utf8');
  fs.renameSync(tempFile, file);
}

function loadAlarm() {
  try {
    const data = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    if (data.alarm && Number.isFinite(data.alarm.at) && typeof data.alarm.timeZone === 'string') activeAlarm = data.alarm;
  } catch (_) {
    activeAlarm = null;
  }
}

function displayTime(alarm) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: alarm.timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(new Date(alarm.at));
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function dismissAlarm() {
  ringing = false;
  if (beepTimer) clearInterval(beepTimer);
  beepTimer = null;
  for (const window of overlayWindows) {
    if (!window.isDestroyed()) window.close();
  }
  overlayWindows = [];
  activeAlarm = null;
  persistAlarm();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('alarm:changed', null);
}

function createOverlay(display, alarm) {
  const { x, y, width, height } = display.bounds;
  const window = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    show: false,
    fullscreen: true,
    skipTaskbar: true,
    backgroundColor: '#c7ff72',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.webContents.on('did-finish-load', () => {
    if (window.isDestroyed()) return;
    window.webContents.send('alarm:ring', { time: displayTime(alarm) });
    window.show();
    window.focus();
  });
  window.on('closed', () => {
    overlayWindows = overlayWindows.filter((item) => item !== window);
  });
  window.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWindows.push(window);
}

function ringAlarm() {
  if (!activeAlarm || ringing || Date.now() < activeAlarm.at) return;
  ringing = true;
  persistAlarm();
  for (const display of screen.getAllDisplays()) createOverlay(display, activeAlarm);
  if (Notification.isSupported()) {
    new Notification({ title: 'Flash Alarm', body: `Your alarm is ringing (${displayTime(activeAlarm)}).` }).show();
  }
  beepTimer = setInterval(() => shell.beep(), 1200);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('alarm:changed', { ...activeAlarm, ringing: true });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 710,
    minWidth: 400,
    minHeight: 610,
    show: false,
    backgroundColor: '#10131a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (event) => {
    if (!quitRequested) {
      event.preventDefault();
      mainWindow.minimize();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.handle('app:state', () => ({
  alarm: activeAlarm ? { ...activeAlarm, ringing } : null,
  launchAtLogin: app.getLoginItemSettings().openAtLogin
}));

ipcMain.handle('alarm:set', (_event, request) => {
  if (!request || typeof request !== 'object') throw new Error('Choose a valid alarm time.');
  const next = createNextAlarm(request);
  dismissAlarm();
  activeAlarm = next;
  persistAlarm();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('alarm:changed', activeAlarm);
  return activeAlarm;
});

ipcMain.handle('alarm:cancel', () => {
  dismissAlarm();
  return null;
});

ipcMain.handle('app:set-launch-at-login', (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.on('alarm:dismiss', dismissAlarm);

if (gotSingleInstanceLock) {
  app.setAppUserModelId(APP_ID);
  app.whenReady().then(() => {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'File', submenu: [{ label: 'Show Flash Alarm', click: showMainWindow }, { type: 'separator' }, { role: 'quit' }] },
      { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: 'Help', submenu: [{ label: 'Open alarm website', click: () => shell.openExternal('https://flash-alarm-monitor.handswatter.workers.dev/') }] }
    ]));
    loadAlarm();
    createMainWindow();
    checkTimer = setInterval(ringAlarm, 500);
  });

  app.on('second-instance', showMainWindow);
  app.on('activate', showMainWindow);
  app.on('window-all-closed', () => {
    // Keep the background alarm scheduler alive until the user chooses Quit.
  });
  app.on('before-quit', () => {
    quitRequested = true;
    if (checkTimer) clearInterval(checkTimer);
    if (beepTimer) clearInterval(beepTimer);
  });
}
