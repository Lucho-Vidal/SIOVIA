const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

let db = null;
const DATABASE_PATH = path.join(app.getPath('userData'), 'database.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'database', 'schema.sql');

function initializeDatabase() {
  // Create or open the database
  db = new Database(DATABASE_PATH);

  // Check if the database is newly created (by checking if a known table exists)
  // We'll check for the existence of a table from our schema, e.g., "solicitudes"
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='solicitudes';").get();
  if (!tableCheck) {
    // Database is new, load the schema
    if (fs.existsSync(SCHEMA_PATH)) {
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
      db.exec(schema);
      console.log('Database schema loaded from', SCHEMA_PATH);
    } else {
      console.error('Schema file not found at', SCHEMA_PATH);
    }
  } else {
    console.log('Existing database found at', DATABASE_PATH);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  // Load Angular app
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:4200');
  } else {
    win.loadFile(path.join(__dirname, 'dist/railway-operations/browser/index.html'));
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  initializeDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Set up IPC handlers for database operations
ipcMain.handle('db-executeQuery', (event, args) => {
  try {
    const { sql, params } = args;
    const stmt = db.prepare(sql);
    const result = stmt.all(params);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-executeNonQuery', (event, args) => {
  try {
    const { sql, params } = args;
    const stmt = db.prepare(sql);
    const info = stmt.run(params);
    return { success: true, changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  } catch (error) {
    return { success: false, error: error.message };
  }
});