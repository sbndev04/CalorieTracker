const { app, BrowserWindow, ipcMain, net, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs/promises');

const SETTINGS_FILE = 'telegram-sync.json';

function settingsPath() {
  return path.join(app.getPath('userData'), SETTINGS_FILE);
}

function normalizeEndpoint(value) {
  const endpoint = String(value || '').trim().replace(/\/+$/, '');
  if (!endpoint) throw new Error('Indica la URL del servicio de Telegram.');
  const url = new URL(endpoint);
  const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) {
    throw new Error('La URL debe usar HTTPS.');
  }
  return endpoint;
}

async function readSyncSettings() {
  try {
    const raw = JSON.parse(await fs.readFile(settingsPath(), 'utf8'));
    let token = '';
    if (raw.token && safeStorage.isEncryptionAvailable()) {
      token = safeStorage.decryptString(Buffer.from(raw.token, 'base64'));
    }
    return { endpoint: raw.endpoint || '', token };
  } catch (error) {
    if (error.code === 'ENOENT') return { endpoint: '', token: '' };
    throw error;
  }
}

async function writeSyncSettings({ endpoint, token }) {
  const current = await readSyncSettings();
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  const nextToken = String(token || current.token || '').trim();
  if (!nextToken) throw new Error('Indica el token de sincronización.');
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('El cifrado seguro del sistema no está disponible.');
  }
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify({
    endpoint: normalizedEndpoint,
    token: safeStorage.encryptString(nextToken).toString('base64')
  }), 'utf8');
  return { endpoint: normalizedEndpoint, configured: true };
}

async function serviceRequest(route, options = {}) {
  const settings = await readSyncSettings();
  if (!settings.endpoint || !settings.token) {
    throw new Error('Configura primero la conexión con Telegram.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await net.fetch(`${normalizeEndpoint(settings.endpoint)}${route}`, {
      method: options.method || 'GET',
      headers: {
        authorization: `Bearer ${settings.token}`,
        accept: 'application/json',
        ...(options.body ? { 'content-type': 'application/json' } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('La conexión con Telegram tardó demasiado.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }
  if (!response.ok) {
    throw new Error(payload.error || `El servicio respondió con ${response.status}.`);
  }
  return payload;
}

function registerTelegramIpc() {
  ipcMain.handle('telegram:get-settings', async () => {
    const settings = await readSyncSettings();
    return { endpoint: settings.endpoint, configured: !!settings.token };
  });
  ipcMain.handle('telegram:save-settings', (_event, settings) => writeSyncSettings(settings || {}));
  ipcMain.handle('telegram:sync-catalog', (_event, catalog) => {
    const recipes = Array.isArray(catalog?.recipes) ? catalog.recipes : [];
    return serviceRequest('/api/catalog', { method: 'PUT', body: { recipes } });
  });
  ipcMain.handle('telegram:sync-daily-status', (_event, status) => {
    return serviceRequest('/api/daily-status', { method: 'PUT', body: status || {} });
  });
  ipcMain.handle('telegram:pull-events', () => serviceRequest('/api/events'));
  ipcMain.handle('telegram:ack-events', (_event, ids) => {
    const eventIds = Array.isArray(ids) ? ids.filter(id => typeof id === 'string').slice(0, 100) : [];
    return serviceRequest('/api/events/ack', { method: 'POST', body: { ids: eventIds } });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#080b0e',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, 'calorie_tracker.html'));
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

app.whenReady().then(() => {
  registerTelegramIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
