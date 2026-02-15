const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    titleBarStyle: 'hiddenInset',
    frame: true,
    backgroundColor: '#667eea'
  });

  // In development, load from localhost
  // In production, load from built files
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle new message notifications
ipcMain.on('new-message', (event, data) => {
  if (!mainWindow.isFocused()) {
    new Notification({
      title: `New message from ${data.from}`,
      body: 'You have a new encrypted message',
      silent: false
    }).show();
  }
});

// Secure storage for encryption keys
ipcMain.handle('store-keys', async (event, keys) => {
  try {
    // In production, encrypt this with user's password
    store.set('encryptionKeys', keys);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-keys', async () => {
  try {
    const keys = store.get('encryptionKeys');
    return { success: true, keys };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-keys', async () => {
  try {
    store.delete('encryptionKeys');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
