import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import fs from 'fs';
import bcrypt from 'bcrypt';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;
let databasePath = null;
const SCHEMA_PATH = path.join(__dirname, 'database', 'schema.sql');
const SALT_ROUNDS = 10;
const DEFAULT_PASSWORDS = {
  admin: 'Admin@123',
  autorizador: 'Autorizador@123',
  operador: 'Operador@123',
  solicitante: 'Solicitante@123',
};

const ROLE_NAMES = {
  admin: 'Administrador',
  autorizador: 'Autorizador',
  operador: 'Operador',
  solicitante: 'Solicitante',
};

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

function hashPassword(password) {
  return bcrypt.hashSync(String(password), SALT_ROUNDS);
}

function validatePasswordPolicy(password) {
  return typeof password === 'string' && password.length >= 8 && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function getRoleIdByName(roleName) {
  const role = db.prepare('SELECT RolID AS id FROM Roles WHERE NombreRol = ?').get(roleName);
  return role ? Number(role.id) : null;
}

function getRolesForUser(userId) {
  return db.prepare(
    `SELECT r.RolID AS id, r.NombreRol AS name
     FROM UsuarioRoles ur
     INNER JOIN Roles r ON r.RolID = ur.RolID
     WHERE ur.UsuarioID = ?
     ORDER BY r.RolID`
  ).all(userId);
}

function getUserByUsername(username) {
  return db.prepare(
    `SELECT
       u.UsuarioID AS userId,
       u.PersonalID AS personalId,
       u.NombreUsuario AS username,
       u.PasswordHash AS passwordHash,
       u.Activo AS active,
       p.Nombre AS personalNombre,
       p.Apellido AS personalApellido
     FROM Usuarios u
     INNER JOIN Personal p ON p.PersonalID = u.PersonalID
     WHERE u.NombreUsuario = ?`
  ).get(username);
}

function getUserById(userId) {
  return db.prepare(
    `SELECT
       u.UsuarioID AS userId,
       u.PersonalID AS personalId,
       u.NombreUsuario AS username,
       u.PasswordHash AS passwordHash,
       u.Activo AS active,
       p.Nombre AS personalNombre,
       p.Apellido AS personalApellido
     FROM Usuarios u
     INNER JOIN Personal p ON p.PersonalID = u.PersonalID
     WHERE u.UsuarioID = ?`
  ).get(userId);
}

function countActiveAdmins(excludeUserId = null) {
  const baseQuery =
    `SELECT COUNT(DISTINCT u.UsuarioID) AS count
     FROM Usuarios u
     INNER JOIN UsuarioRoles ur ON ur.UsuarioID = u.UsuarioID
     INNER JOIN Roles r ON r.RolID = ur.RolID
     WHERE u.Activo = 1 AND r.NombreRol = ?`;

  if (excludeUserId === null) {
    return Number(db.prepare(baseQuery).get(ROLE_NAMES.admin).count ?? 0);
  }

  return Number(db.prepare(`${baseQuery} AND u.UsuarioID != ?`).get(ROLE_NAMES.admin, excludeUserId).count ?? 0);
}

function listRoles() {
  return db.prepare('SELECT RolID AS id, NombreRol AS name FROM Roles ORDER BY RolID').all();
}

function listUsers() {
  const rows = db.prepare(
    `SELECT
       u.UsuarioID AS userId,
       u.PersonalID AS personalId,
       u.NombreUsuario AS username,
       u.Activo AS active,
       p.Nombre AS personalNombre,
       p.Apellido AS personalApellido,
       r.RolID AS roleId,
       r.NombreRol AS roleName
     FROM Usuarios u
     INNER JOIN Personal p ON p.PersonalID = u.PersonalID
     LEFT JOIN UsuarioRoles ur ON ur.UsuarioID = u.UsuarioID
     LEFT JOIN Roles r ON r.RolID = ur.RolID
     ORDER BY u.UsuarioID, r.RolID`
  ).all();

  const users = new Map();

  for (const row of rows) {
    if (!users.has(row.userId)) {
      users.set(row.userId, {
        userId: Number(row.userId),
        personalId: Number(row.personalId),
        username: String(row.username ?? ''),
        active: Boolean(row.active),
        fullName: `${String(row.personalNombre ?? '')} ${String(row.personalApellido ?? '')}`.trim(),
        roles: [],
        roleIds: [],
      });
    }

    if (row.roleId !== null && row.roleId !== undefined) {
      const current = users.get(row.userId);
      current.roles.push(String(row.roleName ?? ''));
      current.roleIds.push(Number(row.roleId));
    }
  }

  return Array.from(users.values());
}

function normalizeRoleNames(roleIds) {
  const validRoleIds = Array.isArray(roleIds) ? roleIds.map((value) => Number(value)).filter(Number.isFinite) : [];
  const roles = listRoles();
  return validRoleIds
    .map((roleId) => roles.find((role) => Number(role.id) === roleId))
    .filter(Boolean)
    .map((role) => String(role.name));
}

function areValidRoleIds(roleIds) {
  const normalized = Array.isArray(roleIds) ? roleIds.map((value) => Number(value)).filter(Number.isFinite) : [];
  const known = new Set(listRoles().map((role) => Number(role.id)));
  return normalized.length > 0 && normalized.every((roleId) => known.has(roleId));
}

function ensureSeededPasswords() {
  const update = db.prepare('UPDATE Usuarios SET PasswordHash = ? WHERE NombreUsuario = ?');

  for (const [username, password] of Object.entries(DEFAULT_PASSWORDS)) {
    const user = db.prepare('SELECT UsuarioID AS id, PasswordHash AS passwordHash FROM Usuarios WHERE NombreUsuario = ?').get(username);

    if (user && !String(user.passwordHash ?? '').startsWith('$2')) {
      update.run(hashPassword(password), username);
    }
  }
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
    { UsuarioID: 1, PersonalID: 1, NombreUsuario: 'admin', PasswordHash: hashPassword(DEFAULT_PASSWORDS.admin), Activo: 1 },
    { UsuarioID: 2, PersonalID: 2, NombreUsuario: 'operador', PasswordHash: hashPassword(DEFAULT_PASSWORDS.operador), Activo: 1 },
    { UsuarioID: 3, PersonalID: 3, NombreUsuario: 'solicitante', PasswordHash: hashPassword(DEFAULT_PASSWORDS.solicitante), Activo: 1 },
    { UsuarioID: 4, PersonalID: 4, NombreUsuario: 'autorizador', PasswordHash: hashPassword(DEFAULT_PASSWORDS.autorizador), Activo: 1 },
  ]);

  insertMany('INSERT OR IGNORE INTO Roles (RolID, NombreRol) VALUES (@RolID, @NombreRol)', [
    { RolID: 1, NombreRol: ROLE_NAMES.admin },
    { RolID: 2, NombreRol: ROLE_NAMES.operador },
    { RolID: 3, NombreRol: ROLE_NAMES.solicitante },
    { RolID: 4, NombreRol: ROLE_NAMES.autorizador },
  ]);

  insertMany('INSERT OR IGNORE INTO UsuarioRoles (UsuarioID, RolID) VALUES (@UsuarioID, @RolID)', [
    { UsuarioID: 1, RolID: 1 },
    { UsuarioID: 2, RolID: 2 },
    { UsuarioID: 3, RolID: 3 },
    { UsuarioID: 4, RolID: 4 },
  ]);

  const demoPasswords = {
    1: DEFAULT_PASSWORDS.admin,
    2: DEFAULT_PASSWORDS.operador,
    3: DEFAULT_PASSWORDS.solicitante,
    4: DEFAULT_PASSWORDS.autorizador,
  };

  for (const [userId, password] of Object.entries(demoPasswords)) {
    db.prepare('UPDATE Usuarios SET PasswordHash = ? WHERE UsuarioID = ?').run(hashPassword(password), Number(userId));
  }

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

  ensureSeededPasswords();
  console.log('Demo data seeded into SQLite');
}

function loadDatabaseConfig() {
  const appDataDir = app.getPath('userData');
  const sioviaConfigDir = path.join(app.getPath('appData'), 'SIOVIA', 'railway-operations');
  const configPaths = [
    path.join(sioviaConfigDir, 'database-config.json'),
    path.join(appDataDir, 'database-config.json'),
  ];
  
  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent);
        
        if (config.databasePath && typeof config.databasePath === 'string') {
          const resolvedPath = path.resolve(config.databasePath);
          console.log(`Base de datos configurada en: ${resolvedPath}`);
          return resolvedPath;
        }
      }
    } catch (error) {
      console.warn(`Error al cargar configuración desde ${configPath}: ${error.message}`);
    }
  }
  
  return null;
}

function initializeDatabase() {
  const configuredPath = loadDatabaseConfig();
  
  if (configuredPath) {
    databasePath = configuredPath;
  } else {
    databasePath = path.join(app.getPath('userData'), 'database.sqlite');
  }
  
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

  seedDatabase();
  ensureSeededPasswords();
}

function waitForDevServer(url, maxRetries = 30, delay = 1000) {
  return new Promise((resolve, reject) => {
    let retries = 0;

    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          console.log('Dev server is ready');
          resolve();
        } else {
          retry();
        }
      }).on('error', () => {
        retry();
      });
    };

    const retry = () => {
      retries++;
      if (retries >= maxRetries) {
        reject(new Error(`Dev server at ${url} not ready after ${maxRetries} retries`));
      } else {
        setTimeout(check, delay);
      }
    };

    check();
  });
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

  const devUrl = 'http://localhost:4200';
  win.webContents.on('did-fail-load', (_event, code, desc) => {
    console.warn(`Failed to load: ${desc}, retrying...`);
    setTimeout(() => win.loadURL(devUrl), 2000);
  });

  win.loadURL(devUrl);
  win.webContents.openDevTools();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  initializeDatabase();
  await waitForDevServer('http://localhost:4200').catch((err) => console.warn(err.message));
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

ipcMain.handle('auth-get-state', () => {
  try {
    const hasUsers = Number(db.prepare('SELECT COUNT(*) AS count FROM Usuarios').get().count ?? 0) > 0;
    const adminCount = countActiveAdmins();
    return { success: true, data: { hasUsers, adminCount } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth-login', (event, args) => {
  try {
    const username = String(args?.username ?? '').trim();
    const password = String(args?.password ?? '');

    if (!username || !password) {
      return { success: false, error: 'Credenciales inválidas' };
    }

    const user = getUserByUsername(username);

    if (!user || !user.active) {
      return { success: false, error: 'Credenciales inválidas' };
    }

    if (!bcrypt.compareSync(password, String(user.passwordHash ?? ''))) {
      return { success: false, error: 'Credenciales inválidas' };
    }

    const roles = getRolesForUser(user.userId).map((role) => String(role.name ?? '').toLowerCase());

    return {
      success: true,
      data: {
        userId: Number(user.userId),
        personalId: Number(user.personalId),
        username: String(user.username ?? ''),
        fullName: `${String(user.personalNombre ?? '')} ${String(user.personalApellido ?? '')}`.trim(),
        roles,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth-list-roles', () => {
  try {
    return { success: true, data: listRoles() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth-list-users', () => {
  try {
    return { success: true, data: listUsers() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth-create-user', (event, args) => {
  try {
    const personalId = Number(args?.personalId);
    const username = String(args?.username ?? '').trim();
    const password = String(args?.password ?? '');
    const roleIds = Array.isArray(args?.roleIds) ? args.roleIds.map((value) => Number(value)).filter(Number.isFinite) : [];

    if (!Number.isFinite(personalId) || !username || !validatePasswordPolicy(password) || !areValidRoleIds(roleIds)) {
      return { success: false, error: 'Datos inválidos para crear el usuario' };
    }

    const personal = db.prepare('SELECT PersonalID AS id FROM Personal WHERE PersonalID = ?').get(personalId);

    if (!personal) {
      return { success: false, error: 'El personal seleccionado no existe' };
    }

    const existing = db.prepare('SELECT UsuarioID AS id FROM Usuarios WHERE NombreUsuario = ?').get(username);

    if (existing) {
      return { success: false, error: 'El nombre de usuario ya existe' };
    }

    const insertUser = db.prepare('INSERT INTO Usuarios (PersonalID, NombreUsuario, PasswordHash, Activo) VALUES (?, ?, ?, 1)');
    const insertRole = db.prepare('INSERT INTO UsuarioRoles (UsuarioID, RolID) VALUES (?, ?)');
    const passwordHash = hashPassword(password);

    const transaction = db.transaction(() => {
      const result = insertUser.run(personalId, username, passwordHash);
      for (const roleId of roleIds) {
        insertRole.run(result.lastInsertRowid, roleId);
      }
      return result.lastInsertRowid;
    });

    const userId = transaction();
    return { success: true, data: { userId } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth-update-user-roles', (event, args) => {
  try {
    const userId = Number(args?.userId);
    const roleIds = Array.isArray(args?.roleIds) ? args.roleIds.map((value) => Number(value)).filter(Number.isFinite) : [];

    if (!Number.isFinite(userId) || !areValidRoleIds(roleIds)) {
      return { success: false, error: 'Datos inválidos para actualizar roles' };
    }

    const user = getUserById(userId);

    if (!user) {
      return { success: false, error: 'El usuario no existe' };
    }

    const currentRoles = getRolesForUser(userId).map((role) => String(role.name ?? '').toLowerCase());
    const nextRoles = normalizeRoleNames(roleIds).map((role) => String(role).toLowerCase());

    if (currentRoles.includes('administrador') && !nextRoles.includes('administrador') && countActiveAdmins(userId) <= 0) {
      return { success: false, error: 'Debe existir al menos un administrador activo' };
    }

    const deleteRoles = db.prepare('DELETE FROM UsuarioRoles WHERE UsuarioID = ?');
    const insertRole = db.prepare('INSERT INTO UsuarioRoles (UsuarioID, RolID) VALUES (?, ?)');

    const transaction = db.transaction(() => {
      deleteRoles.run(userId);
      for (const roleId of roleIds) {
        insertRole.run(userId, roleId);
      }
    });

    transaction();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
