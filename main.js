// CueLab — Electron main process
const { app, BrowserWindow, session, Menu, shell } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Permissions the app needs: MIDI (DDJ-FLX4), audio output selection.
const ALLOWED = new Set(['midi', 'midiSysex', 'media', 'speaker-selection', 'clipboard-sanitized-write']);

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#0E0F13',
    title: 'CueLab',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false // keep audio + MIDI timing steady when the window is in the background
    }
  });

  win.once('ready-to-show', () => { win.maximize(); win.show(); });

  // F11 = full screen, Ctrl+R = reload, Ctrl+Shift+I = dev tools
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.control && input.shift && input.key.toLowerCase() === 'i') { win.webContents.toggleDevTools(); e.preventDefault(); }
  });

  // Open web links in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(ALLOWED.has(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => ALLOWED.has(permission));
  Menu.setApplicationMenu(null);
  createWindow();
});

app.on('window-all-closed', () => app.quit());
