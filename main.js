const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

let db = null;
let databasePath = null;
const SCHEMA_PATH = path.join(__dirname, 'database', 'schema.sql');

function bindParams(stmt, params) {
  if (Array.isArray(params)) {
    return stmt.all(...params);
  }

  if (params && typeof params === 'object') {
    return stmt.all(params);
  }

  return stmt.all();
}

function runParams(stmt, params) {
  if (Array.isArray(params)) {
    return stmt.run(...params);
  }

  if (params && typeof params === 'object') {
    return stmt.run(params);
  }

  return stmt.run();
}

function seedDatabase() {
  const seedCount = db.prepare('SELECT COUNT(*) AS count FROM Solicitudes;').get().count;

  if (seedCount > 0) {
    return;
  }

  const insertMany = (sql, rows) => {
    const stmt = db.prepare(sql);
    const transaction = db.transaction((items) => {
      for (const item of items) {
        stmt.run(item);
      }
    });

    transaction(rows);
  };

  insertMany('INSERT OR IGNORE INTO Sectores (SectorID, Nombre, Descripcion, Activo) VALUES (@SectorID, @Nombre, @Descripcion, @Activo)', [
    { SectorID: 1, Nombre: 'Vías y Obras', Descripcion: 'Trabajos de infraestructura ferroviaria', Activo: 1 },
    { SectorID: 2, Nombre: 'Señalamiento', Descripcion: 'Mantenimiento de señalamiento', Activo: 1 },
    { SectorID: 3, Nombre: 'Energía', Descripcion: 'Intervenciones eléctricas y de potencia', Activo: 1 },
    { SectorID: 4, Nombre: 'Operaciones', Descripcion: 'Coordinación operativa general', Activo: 1 },
  ]);

  insertMany('INSERT OR IGNORE INTO SeccionesEnergia (SeccionID, Nombre, Descripcion, Activo) VALUES (@SeccionID, @Nombre, @Descripcion, @Activo)', [
    { SeccionID: 1, Nombre: 'Cabecera Norte', Descripcion: 'Sección principal norte', Activo: 1 },
    { SeccionID: 2, Nombre: 'Cabecera Sur', Descripcion: 'Sección principal sur', Activo: 1 },
  ]);

  insertMany('INSERT OR IGNORE INTO MotivosSuspension (MotivoID, Descripcion, Activo) VALUES (@MotivoID, @Descripcion, @Activo)', [
    { MotivoID: 1, Descripcion: 'Mantenimiento preventivo', Activo: 1 },
    { MotivoID: 2, Descripcion: 'Intervención correctiva', Activo: 1 },
  ]);

  insertMany('INSERT OR IGNORE INTO CausasOperativas (CausaID, Descripcion, Activo) VALUES (@CausaID, @Descripcion, @Activo)', [
    { CausaID: 1, Descripcion: 'Falla en equipo de campo', Activo: 1 },
    { CausaID: 2, Descripcion: 'Reprogramación por clima', Activo: 1 },
  ]);

  insertMany('INSERT OR IGNORE INTO EstadosSolicitud (EstadoID, Descripcion) VALUES (@EstadoID, @Descripcion)', [
    { EstadoID: 1, Descripcion: 'Pendiente' },
    { EstadoID: 2, Descripcion: 'Autorizada' },
    { EstadoID: 3, Descripcion: 'Ejecutada' },
    { EstadoID: 4, Descripcion: 'Observada' },
  ]);

  insertMany('INSERT OR IGNORE INTO EstadosAutorizacion (EstadoID, Descripcion) VALUES (@EstadoID, @Descripcion)', [
    { EstadoID: 1, Descripcion: 'Pendiente' },
    { EstadoID: 2, Descripcion: 'Aprobada' },
    { EstadoID: 3, Descripcion: 'Rechazada' },
  ]);

  insertMany('INSERT OR IGNORE INTO EstadosEjecucion (EstadoID, Descripcion) VALUES (@EstadoID, @Descripcion)', [
    { EstadoID: 1, Descripcion: 'Pendiente' },
    { EstadoID: 2, Descripcion: 'En curso' },
    { EstadoID: 3, Descripcion: 'Finalizada' },
  ]);

  insertMany('INSERT OR IGNORE INTO Oficinas (OficinaID, Nombre, Activo) VALUES (@OficinaID, @Nombre, @Activo)', [
    { OficinaID: 1, Nombre: 'Central', Activo: 1 },
    { OficinaID: 2, Nombre: 'Norte', Activo: 1 },
    { OficinaID: 3, Nombre: 'Sur', Activo: 1 },
  ]);

  insertMany('INSERT OR IGNORE INTO Personal (PersonalID, Nombre, Apellido, Legajo, Cargo, Activo) VALUES (@PersonalID, @Nombre, @Apellido, @Legajo, @Cargo, @Activo)', [
    { PersonalID: 1, Nombre: 'M.', Apellido: 'Gómez', Legajo: 'L-1001', Cargo: 'Jefe de sector', Activo: 1 },
    { PersonalID: 2, Nombre: 'L.', Apellido: 'Ruiz', Legajo: 'L-1002', Cargo: 'Supervisor', Activo: 1 },
    { PersonalID: 3, Nombre: 'S.', Apellido: 'Pérez', Legajo: 'L-1003', Cargo: 'Técnico', Activo: 1 },
    { PersonalID: 4, Nombre: 'A.', Apellido: 'Torres', Legajo: 'L-1004', Cargo: 'Operador', Activo: 1 },
  ]);

  insertMany('INSERT OR IGNORE INTO Usuarios (UsuarioID, PersonalID, NombreUsuario, PasswordHash, Activo) VALUES (@UsuarioID, @PersonalID, @NombreUsuario, @PasswordHash, @Activo)', [
    { UsuarioID: 1, PersonalID: 1, NombreUsuario: 'admin', PasswordHash: 'demo-hash', Activo: 1 },
    { UsuarioID: 2, PersonalID: 2, NombreUsuario: 'operador', PasswordHash: 'demo-hash', Activo: 1 },
  ]);

  insertMany('INSERT OR IGNORE INTO Roles (RolID, NombreRol) VALUES (@RolID, @NombreRol)', [
    { RolID: 1, NombreRol: 'Administrador' },
    { RolID: 2, NombreRol: 'Operador' },
  ]);

  insertMany('INSERT OR IGNORE INTO UsuarioRoles (UsuarioID, RolID) VALUES (@UsuarioID, @RolID)', [
    { UsuarioID: 1, RolID: 1 },
    { UsuarioID: 2, RolID: 2 },
  ]);

  insertMany('INSERT OR IGNORE INTO Solicitudes (SolicitudID, SectorID, OficinaID, SolicitanteID, FechaSolicitud, HoraInicioPrevista, HoraFinPrevista, Motivo, Observaciones, EstadoID, UsuarioCreadorID) VALUES (@SolicitudID, @SectorID, @OficinaID, @SolicitanteID, @FechaSolicitud, @HoraInicioPrevista, @HoraFinPrevista, @Motivo, @Observaciones, @EstadoID, @UsuarioCreadorID)', [
    {
      SolicitudID: 1042,
      SectorID: 1,
      OficinaID: 1,
      SolicitanteID: 1,
      FechaSolicitud: '2026-04-25',
      HoraInicioPrevista: '08:00',
      HoraFinPrevista: '12:00',
      Motivo: 'Mantenimiento preventivo de vía principal',
      Observaciones: 'Requiere confirmación de ventana operativa.',
      EstadoID: 1,
      UsuarioCreadorID: 1,
    },
    {
      SolicitudID: 1043,
      SectorID: 2,
      OficinaID: 2,
      SolicitanteID: 2,
      FechaSolicitud: '2026-04-25',
      HoraInicioPrevista: '10:00',
      HoraFinPrevista: '13:30',
      Motivo: 'Intervención sobre equipo de enclavamiento',
      Observaciones: 'Autorizada por jefatura de turno.',
      EstadoID: 2,
      UsuarioCreadorID: 1,
    },
    {
      SolicitudID: 1044,
      SectorID: 3,
      OficinaID: 1,
      SolicitanteID: 3,
      FechaSolicitud: '2026-04-24',
      HoraInicioPrevista: '14:00',
      HoraFinPrevista: '16:00',
      Motivo: 'Ajuste de sección de energía',
      Observaciones: 'Trabajo finalizado sin incidentes.',
      EstadoID: 3,
      UsuarioCreadorID: 1,
    },
    {
      SolicitudID: 1045,
      SectorID: 4,
      OficinaID: 3,
      SolicitanteID: 4,
      FechaSolicitud: '2026-04-23',
      HoraInicioPrevista: '09:30',
      HoraFinPrevista: '11:00',
      Motivo: 'Novedad reportada por patrulla',
      Observaciones: 'Falta completar causa operativa.',
      EstadoID: 4,
      UsuarioCreadorID: 2,
    },
  ]);

  insertMany('INSERT OR IGNORE INTO Autorizaciones (AutorizacionID, SolicitudID, OficinaID, AutorizadorID, FechaAutorizacion, HoraInicioAutorizada, HoraFinAutorizada, Observaciones, EstadoID, UsuarioCreadorID) VALUES (@AutorizacionID, @SolicitudID, @OficinaID, @AutorizadorID, @FechaAutorizacion, @HoraInicioAutorizada, @HoraFinAutorizada, @Observaciones, @EstadoID, @UsuarioCreadorID)', [
    {
      AutorizacionID: 2001,
      SolicitudID: 1043,
      OficinaID: 2,
      AutorizadorID: 1,
      FechaAutorizacion: '2026-04-25',
      HoraInicioAutorizada: '10:15',
      HoraFinAutorizada: '13:00',
      Observaciones: 'Ventana operativa aprobada.',
      EstadoID: 2,
      UsuarioCreadorID: 1,
    },
    {
      AutorizacionID: 2002,
      SolicitudID: 1042,
      OficinaID: 1,
      AutorizadorID: 2,
      FechaAutorizacion: '2026-04-25',
      HoraInicioAutorizada: '08:10',
      HoraFinAutorizada: '11:45',
      Observaciones: 'Pendiente de confirmación final.',
      EstadoID: 1,
      UsuarioCreadorID: 1,
    },
  ]);

  console.log('Demo data seeded into SQLite');
}

function ensureSolicitanteAccess() {
  db.exec(`
    INSERT OR IGNORE INTO Roles (RolID, NombreRol) VALUES (3, 'Solicitante');
    INSERT OR IGNORE INTO Usuarios (UsuarioID, PersonalID, NombreUsuario, PasswordHash, Activo)
      VALUES (3, 4, 'solicitante', 'demo-hash', 1);
    INSERT OR IGNORE INTO UsuarioRoles (UsuarioID, RolID) VALUES (3, 3);
  `);
}

function initializeDatabase() {
  databasePath = path.join(app.getPath('userData'), 'database.sqlite');
  db = new Database(databasePath);
  db.pragma('foreign_keys = ON');

  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Solicitudes';").get();

  if (!tableCheck) {
    if (fs.existsSync(SCHEMA_PATH)) {
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
      db.exec(schema);
      console.log('Database schema loaded from', SCHEMA_PATH);
    } else {
      console.error('Schema file not found at', SCHEMA_PATH);
    }
  } else {
    console.log('Existing database found at', databasePath);
  }

  ensureSolicitanteAccess();
  seedDatabase();
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
    const result = bindParams(stmt, params);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-executeNonQuery', (event, args) => {
  try {
    const { sql, params } = args;
    const stmt = db.prepare(sql);
    const info = runParams(stmt, params);
    return { success: true, changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
