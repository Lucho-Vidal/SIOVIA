-- =============================================
-- TABLAS DE REFERENCIA (CATÁLOGOS)
-- =============================================

CREATE TABLE Sectores (
    SectorID INTEGER PRIMARY KEY,
    Nombre TEXT NOT NULL,
    Descripcion TEXT,
    Activo INTEGER DEFAULT 1
);

CREATE TABLE SeccionesEnergia (
    SeccionID INTEGER PRIMARY KEY,
    Nombre TEXT NOT NULL,
    Descripcion TEXT,
    Activo INTEGER DEFAULT 1
);

CREATE TABLE MotivosSuspension (
    MotivoID INTEGER PRIMARY KEY,
    Descripcion TEXT NOT NULL UNIQUE,
    Activo INTEGER DEFAULT 1
);

CREATE TABLE CausasOperativas (
    CausaID INTEGER PRIMARY KEY,
    Descripcion TEXT NOT NULL UNIQUE,
    Activo INTEGER DEFAULT 1
);

CREATE TABLE EstadosSolicitud (
    EstadoID INTEGER PRIMARY KEY,
    Descripcion TEXT NOT NULL UNIQUE
);

CREATE TABLE EstadosAutorizacion (
    EstadoID INTEGER PRIMARY KEY,
    Descripcion TEXT NOT NULL UNIQUE
);

CREATE TABLE EstadosEjecucion (
    EstadoID INTEGER PRIMARY KEY,
    Descripcion TEXT NOT NULL UNIQUE
);

CREATE TABLE Oficinas (
    OficinaID INTEGER PRIMARY KEY,
    Nombre TEXT NOT NULL UNIQUE,
    Activo INTEGER DEFAULT 1
);

-- =============================================
-- TABLAS DE SEGURIDAD (DEBEN IR PRIMERO POR LAS FK)
-- =============================================

CREATE TABLE Personal (
    PersonalID INTEGER PRIMARY KEY,
    Nombre TEXT NOT NULL,
    Apellido TEXT NOT NULL,
    Legajo TEXT NOT NULL UNIQUE,
    Cargo TEXT,
    Activo INTEGER DEFAULT 1
);

CREATE TABLE Usuarios (
    UsuarioID INTEGER PRIMARY KEY,
    PersonalID INTEGER NOT NULL,
    NombreUsuario TEXT NOT NULL UNIQUE,
    PasswordHash TEXT NOT NULL,
    Activo INTEGER DEFAULT 1,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (PersonalID) REFERENCES Personal(PersonalID)
);

CREATE TABLE Roles (
    RolID INTEGER PRIMARY KEY,
    NombreRol TEXT NOT NULL UNIQUE
);

CREATE TABLE UsuarioRoles (
    UsuarioID INTEGER NOT NULL,
    RolID INTEGER NOT NULL,
    PRIMARY KEY (UsuarioID, RolID),
    FOREIGN KEY (UsuarioID) REFERENCES Usuarios(UsuarioID),
    FOREIGN KEY (RolID) REFERENCES Roles(RolID)
);



-- =============================================
-- TABLA SOLICITUDES (CON AUDITORÍA Y ESTADO)
-- =============================================

CREATE TABLE Solicitudes (
    SolicitudID INTEGER PRIMARY KEY,
    SectorID INTEGER NOT NULL,
    OficinaID INTEGER NOT NULL,
    SolicitanteID INTEGER NOT NULL,
    FechaSolicitud DATE NOT NULL,
    HoraInicioPrevista TIME,
    HoraFinPrevista TIME,
    Motivo TEXT,
    Observaciones TEXT,
    EstadoID INTEGER NOT NULL,
    UsuarioCreadorID INTEGER NOT NULL,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    UsuarioModificadorID INTEGER,
    FechaModificacion DATETIME,
    FOREIGN KEY (SectorID) REFERENCES Sectores(SectorID),
    FOREIGN KEY (OficinaID) REFERENCES Oficinas(OficinaID),
    FOREIGN KEY (SolicitanteID) REFERENCES Personal(PersonalID),
    FOREIGN KEY (EstadoID) REFERENCES EstadosSolicitud(EstadoID),
    FOREIGN KEY (UsuarioCreadorID) REFERENCES Usuarios(UsuarioID),
    FOREIGN KEY (UsuarioModificadorID) REFERENCES Usuarios(UsuarioID)
);

-- =============================================
-- TABLA AUTORIZACIONES (CON AUDITORÍA Y ESTADO)
-- =============================================

CREATE TABLE Autorizaciones (
    AutorizacionID INTEGER PRIMARY KEY,
    SolicitudID INTEGER NOT NULL,
    OficinaID INTEGER NOT NULL,
    AutorizadorID INTEGER NOT NULL,
    FechaAutorizacion DATE NOT NULL,
    HoraInicioAutorizada TIME,
    HoraFinAutorizada TIME,
    Observaciones TEXT,
    EstadoID INTEGER NOT NULL,
    UsuarioCreadorID INTEGER NOT NULL,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    UsuarioModificadorID INTEGER,
    FechaModificacion DATETIME,
    FOREIGN KEY (SolicitudID) REFERENCES Solicitudes(SolicitudID),
    FOREIGN KEY (OficinaID) REFERENCES Oficinas(OficinaID),
    FOREIGN KEY (AutorizadorID) REFERENCES Personal(PersonalID),
    FOREIGN KEY (EstadoID) REFERENCES EstadosAutorizacion(EstadoID),
    FOREIGN KEY (UsuarioCreadorID) REFERENCES Usuarios(UsuarioID),
    FOREIGN KEY (UsuarioModificadorID) REFERENCES Usuarios(UsuarioID)
);

-- =============================================
-- TABLA EJECUCIONES (SIN SECTORID, CON AUDITORÍA Y ESTADO)
-- =============================================

CREATE TABLE Ejecuciones (
    EjecucionID INTEGER PRIMARY KEY,
    AutorizacionID INTEGER NOT NULL,
    PersonalEncargadoID INTEGER NOT NULL,
    FechaEjecucion DATE NOT NULL,
    HoraInicioReal TIME,
    HoraFinReal TIME,
    TrabajoRealizado TEXT,
    Observaciones TEXT,
    EstadoID INTEGER NOT NULL,
    UsuarioCreadorID INTEGER NOT NULL,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    UsuarioModificadorID INTEGER,
    FechaModificacion DATETIME,
    FOREIGN KEY (AutorizacionID) REFERENCES Autorizaciones(AutorizacionID),
    FOREIGN KEY (PersonalEncargadoID) REFERENCES Personal(PersonalID),
    FOREIGN KEY (EstadoID) REFERENCES EstadosEjecucion(EstadoID),
    FOREIGN KEY (UsuarioCreadorID) REFERENCES Usuarios(UsuarioID),
    FOREIGN KEY (UsuarioModificadorID) REFERENCES Usuarios(UsuarioID)
);

-- =============================================
-- TABLA NOVEDADES (CON AUDITORÍA)
-- =============================================

CREATE TABLE Novedades (
    NovedadID INTEGER PRIMARY KEY,
    SectorID INTEGER NOT NULL,
    SeccionID INTEGER,
    MotivoID INTEGER,
    CausaID INTEGER,
    PersonalReportaID INTEGER NOT NULL,
    OficinaID INTEGER NOT NULL,
    FechaNovedad DATE NOT NULL,
    Descripcion TEXT NOT NULL,
    AccionTomada TEXT,
    UsuarioCreadorID INTEGER NOT NULL,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    UsuarioModificadorID INTEGER,
    FechaModificacion DATETIME,
    FOREIGN KEY (SectorID) REFERENCES Sectores(SectorID),
    FOREIGN KEY (SeccionID) REFERENCES SeccionesEnergia(SeccionID),
    FOREIGN KEY (MotivoID) REFERENCES MotivosSuspension(MotivoID),
    FOREIGN KEY (CausaID) REFERENCES CausasOperativas(CausaID),
    FOREIGN KEY (OficinaID) REFERENCES Oficinas(OficinaID),
    FOREIGN KEY (PersonalReportaID) REFERENCES Personal(PersonalID),
    FOREIGN KEY (UsuarioCreadorID) REFERENCES Usuarios(UsuarioID),
    FOREIGN KEY (UsuarioModificadorID) REFERENCES Usuarios(UsuarioID)
);

-- =============================================
-- TABLAS INTERMEDIAS (NORMALIZACIÓN MÚLTIPLE)
-- =============================================

CREATE TABLE AutorizacionSectores (
    AutorizacionID INTEGER NOT NULL,
    SectorID INTEGER NOT NULL,
    PRIMARY KEY (AutorizacionID, SectorID),
    FOREIGN KEY (AutorizacionID) REFERENCES Autorizaciones(AutorizacionID),
    FOREIGN KEY (SectorID) REFERENCES Sectores(SectorID)
);

CREATE TABLE AutorizacionSecciones (
    AutorizacionID INTEGER NOT NULL,
    SeccionID INTEGER NOT NULL,
    PRIMARY KEY (AutorizacionID, SeccionID),
    FOREIGN KEY (AutorizacionID) REFERENCES Autorizaciones(AutorizacionID),
    FOREIGN KEY (SeccionID) REFERENCES SeccionesEnergia(SeccionID)
);

CREATE TABLE EjecucionSecciones (
    EjecucionID INTEGER NOT NULL,
    SeccionID INTEGER NOT NULL,
    PRIMARY KEY (EjecucionID, SeccionID),
    FOREIGN KEY (EjecucionID) REFERENCES Ejecuciones(EjecucionID),
    FOREIGN KEY (SeccionID) REFERENCES SeccionesEnergia(SeccionID)
);

-- =============================================
-- ÍNDICES RECOMENDADOS PARA RENDIMIENTO
-- =============================================

CREATE INDEX idx_solicitudes_sector ON Solicitudes(SectorID);
CREATE INDEX idx_solicitudes_oficina ON Solicitudes(OficinaID);
CREATE INDEX idx_solicitudes_estado ON Solicitudes(EstadoID);
CREATE INDEX idx_solicitudes_fecha ON Solicitudes(FechaSolicitud);
CREATE INDEX idx_autorizaciones_solicitud ON Autorizaciones(SolicitudID);
CREATE INDEX idx_autorizaciones_oficina ON Autorizaciones(OficinaID);
CREATE INDEX idx_autorizaciones_estado ON Autorizaciones(EstadoID);
CREATE INDEX idx_ejecuciones_autorizacion ON Ejecuciones(AutorizacionID);
CREATE INDEX idx_ejecuciones_estado ON Ejecuciones(EstadoID);
CREATE INDEX idx_novedades_sector ON Novedades(SectorID);
CREATE INDEX idx_novedades_oficina ON Novedades(OficinaID);
CREATE INDEX idx_novedades_fecha ON Novedades(FechaNovedad);
CREATE INDEX idx_usuarios_nombre ON Usuarios(NombreUsuario);
CREATE INDEX idx_autorizacion_sectores ON AutorizacionSectores(SectorID);
CREATE INDEX idx_autorizacion_secciones ON AutorizacionSecciones(SeccionID);
CREATE INDEX idx_ejecucion_secciones ON EjecucionSecciones(SeccionID);