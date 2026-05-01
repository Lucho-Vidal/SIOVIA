import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

import { AuthService } from './core/auth/auth.service';
import { DatabaseService } from './core/database/database.service';

type EstadoSolicitud = 'Pendiente' | 'Autorizada' | 'Ejecutada' | 'Observada';

interface LookupItem {
  id: number;
  nombre: string;
}

interface SolicitudRecord {
  id: number;
  sectorId: number;
  oficinaId: number;
  solicitanteId: number;
  fecha: string;
  inicio: string;
  fin: string;
  motivo: string;
  estadoId: number;
  observaciones: string;
}

interface SolicitudView extends SolicitudRecord {
  sector: string;
  oficina: string;
  solicitante: string;
  estado: string;
}

interface SolicitudFormValue {
  id: number | null;
  sectorId: number | null;
  oficinaId: number | null;
  solicitanteId: number | null;
  fecha: string;
  inicio: string;
  fin: string;
  motivo: string;
  estadoId: number | null;
  observaciones: string;
}

interface SolicitudDraft extends Omit<SolicitudRecord, 'id'> {
  id: number | null;
}

interface AutorizacionRecord {
  id: number;
  solicitudId: number;
  oficinaId: number;
  autorizadorId: number;
  fecha: string;
  inicio: string;
  fin: string;
  observaciones: string;
  estadoId: number;
}

interface AutorizacionView extends AutorizacionRecord {
  solicitud: string;
  oficina: string;
  autorizador: string;
  estado: string;
}

interface AutorizacionFormValue {
  id: number | null;
  solicitudId: number | null;
  oficinaId: number | null;
  autorizadorId: number | null;
  fecha: string;
  inicio: string;
  fin: string;
  observaciones: string;
  estadoId: number | null;
}

interface AutorizacionDraft extends Omit<AutorizacionRecord, 'id'> {
  id: number | null;
}

const DEMO_SECTORES: LookupItem[] = [
  { id: 1, nombre: 'Vías y Obras' },
  { id: 2, nombre: 'Señalamiento' },
  { id: 3, nombre: 'Energía' },
  { id: 4, nombre: 'Operaciones' },
];

const DEMO_OFICINAS: LookupItem[] = [
  { id: 1, nombre: 'Central' },
  { id: 2, nombre: 'Norte' },
  { id: 3, nombre: 'Sur' },
];

const DEMO_PERSONAL: LookupItem[] = [
  { id: 1, nombre: 'M. Gómez' },
  { id: 2, nombre: 'L. Ruiz' },
  { id: 3, nombre: 'S. Pérez' },
  { id: 4, nombre: 'A. Torres' },
];

const DEMO_ESTADOS: LookupItem[] = [
  { id: 1, nombre: 'Pendiente' },
  { id: 2, nombre: 'Autorizada' },
  { id: 3, nombre: 'Ejecutada' },
  { id: 4, nombre: 'Observada' },
];

const DEMO_ESTADOS_AUTORIZACION: LookupItem[] = [
  { id: 1, nombre: 'Pendiente' },
  { id: 2, nombre: 'Aprobada' },
  { id: 3, nombre: 'Rechazada' },
];

const DEMO_SOLICITUDES: SolicitudRecord[] = [
  {
    id: 1042,
    sectorId: 1,
    oficinaId: 1,
    solicitanteId: 1,
    fecha: '2026-04-25',
    inicio: '08:00',
    fin: '12:00',
    motivo: 'Mantenimiento preventivo de vía principal',
    estadoId: 1,
    observaciones: 'Requiere confirmación de ventana operativa.',
  },
  {
    id: 1043,
    sectorId: 2,
    oficinaId: 2,
    solicitanteId: 2,
    fecha: '2026-04-25',
    inicio: '10:00',
    fin: '13:30',
    motivo: 'Intervención sobre equipo de enclavamiento',
    estadoId: 2,
    observaciones: 'Autorizada por jefatura de turno.',
  },
  {
    id: 1044,
    sectorId: 3,
    oficinaId: 1,
    solicitanteId: 3,
    fecha: '2026-04-24',
    inicio: '14:00',
    fin: '16:00',
    motivo: 'Ajuste de sección de energía',
    estadoId: 3,
    observaciones: 'Trabajo finalizado sin incidentes.',
  },
  {
    id: 1045,
    sectorId: 4,
    oficinaId: 3,
    solicitanteId: 4,
    fecha: '2026-04-23',
    inicio: '09:30',
    fin: '11:00',
    motivo: 'Novedad reportada por patrulla',
    estadoId: 4,
    observaciones: 'Falta completar causa operativa.',
  },
];

const DEMO_AUTORIZACIONES: AutorizacionRecord[] = [
  {
    id: 2001,
    solicitudId: 1043,
    oficinaId: 2,
    autorizadorId: 1,
    fecha: '2026-04-25',
    inicio: '10:15',
    fin: '13:00',
    observaciones: 'Ventana operativa aprobada.',
    estadoId: 2,
  },
  {
    id: 2002,
    solicitudId: 1042,
    oficinaId: 1,
    autorizadorId: 2,
    fecha: '2026-04-25',
    inicio: '08:10',
    fin: '11:45',
    observaciones: 'Pendiente de confirmación final.',
    estadoId: 1,
  },
];

const QUERY_SOLICITUDES = `
  SELECT
    s.SolicitudID AS id,
    s.SectorID AS sectorId,
    s.OficinaID AS oficinaId,
    s.SolicitanteID AS solicitanteId,
    s.FechaSolicitud AS fecha,
    COALESCE(s.HoraInicioPrevista, '') AS inicio,
    COALESCE(s.HoraFinPrevista, '') AS fin,
    COALESCE(s.Motivo, '') AS motivo,
    s.EstadoID AS estadoId,
    COALESCE(s.Observaciones, '') AS observaciones
  FROM Solicitudes s
  ORDER BY s.FechaSolicitud DESC, s.SolicitudID DESC;
`;

const QUERY_SECTORES = `SELECT SectorID AS id, Nombre AS nombre FROM Sectores WHERE Activo = 1 ORDER BY Nombre;`;
const QUERY_OFICINAS = `SELECT OficinaID AS id, Nombre AS nombre FROM Oficinas WHERE Activo = 1 ORDER BY Nombre;`;
const QUERY_PERSONAL = `SELECT PersonalID AS id, Nombre || ' ' || Apellido AS nombre FROM Personal WHERE Activo = 1 ORDER BY Nombre, Apellido;`;
const QUERY_ESTADOS = `SELECT EstadoID AS id, Descripcion AS nombre FROM EstadosSolicitud ORDER BY EstadoID;`;
const QUERY_AUTORIZACIONES = `
  SELECT
    a.AutorizacionID AS id,
    a.SolicitudID AS solicitudId,
    a.OficinaID AS oficinaId,
    a.AutorizadorID AS autorizadorId,
    a.FechaAutorizacion AS fecha,
    COALESCE(a.HoraInicioAutorizada, '') AS inicio,
    COALESCE(a.HoraFinAutorizada, '') AS fin,
    COALESCE(a.Observaciones, '') AS observaciones,
    a.EstadoID AS estadoId
  FROM Autorizaciones a
  ORDER BY a.FechaAutorizacion DESC, a.AutorizacionID DESC;
`;
const QUERY_ESTADOS_AUTORIZACION = `SELECT EstadoID AS id, Descripcion AS nombre FROM EstadosAutorizacion ORDER BY EstadoID;`;

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const normalizeTime = (value: unknown): string => normalizeText(value);

const timeToMinutes = (value: string): number | null => {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value.split(':').map((part) => Number(part));

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

const lookupName = (items: LookupItem[], id: number | null): string => {
  if (id === null) {
    return 'Sin dato';
  }

  return items.find((item) => item.id === id)?.nombre ?? 'Sin dato';
};

const uniqueValues = (items: string[]): string[] => Array.from(new Set(items));

const buildDemoFormValue = (): SolicitudFormValue => ({
  id: null,
  sectorId: DEMO_SECTORES[0]?.id ?? null,
  oficinaId: DEMO_OFICINAS[0]?.id ?? null,
  solicitanteId: DEMO_PERSONAL[0]?.id ?? null,
  fecha: todayIso(),
  inicio: '',
  fin: '',
  motivo: '',
  estadoId: DEMO_ESTADOS[0]?.id ?? null,
  observaciones: '',
});

@Component({
  selector: 'app-workspace',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly mode = signal<'demo' | 'sqlite'>('demo');
  protected readonly isBusy = signal(false);
  protected readonly statusMessage = signal('Listo para trabajar');
  protected readonly currentSession = computed(() => this.auth.session());

  protected readonly sectores = signal<LookupItem[]>(DEMO_SECTORES);
  protected readonly oficinas = signal<LookupItem[]>(DEMO_OFICINAS);
  protected readonly personal = signal<LookupItem[]>(DEMO_PERSONAL);
  protected readonly estados = signal<LookupItem[]>(DEMO_ESTADOS);
  protected readonly estadosAutorizacion = signal<LookupItem[]>(DEMO_ESTADOS_AUTORIZACION);
  protected readonly solicitudes = signal<SolicitudRecord[]>(DEMO_SOLICITUDES);
  protected readonly autorizaciones = signal<AutorizacionRecord[]>(DEMO_AUTORIZACIONES);
  protected readonly selectedSolicitudId = signal<number | null>(DEMO_SOLICITUDES[0]?.id ?? null);
  protected readonly selectedAutorizacionId = signal<number | null>(DEMO_AUTORIZACIONES[0]?.id ?? null);

  protected readonly filters = signal({
    estado: 'Todos',
    sector: 'Todos',
    oficina: 'Todas',
  });

  readonly form: FormGroup;
  readonly authorizationForm: FormGroup;

  protected readonly currentRole = computed(() => this.primaryRole(this.currentSession()?.roles ?? []));
  protected readonly currentPersonalId = computed(() => this.currentSession()?.personalId ?? null);
  protected readonly canManageSolicitudes = computed(() => {
    const role = this.currentRole();
    return role === 'administrador' || role === 'solicitante';
  });
  protected readonly canManageAutorizaciones = computed(() => {
    const role = this.currentRole();
    return role === 'administrador' || role === 'autorizador';
  });
  protected readonly visiblePersonal = computed(() => {
    const role = this.currentRole();
    if (role === 'solicitante' && this.currentPersonalId() !== null) {
      return this.personal().filter((item) => item.id === this.currentPersonalId());
    }

    return this.personal();
  });
  protected readonly roleLabel = computed(() => {
    switch (this.currentRole()) {
      case 'administrador':
        return 'Administrador con acceso total';
      case 'autorizador':
        return 'Autorizador con vista completa';
      case 'operador':
        return 'Operador con solicitudes autorizadas';
      default:
        return 'Solicitante con acceso a sus solicitudes';
    }
  });

  protected readonly solicitudRows = computed<SolicitudView[]>(() =>
    this.solicitudes().map((solicitud) => ({
      ...solicitud,
      sector: lookupName(this.sectores(), solicitud.sectorId),
      oficina: lookupName(this.oficinas(), solicitud.oficinaId),
      solicitante: lookupName(this.personal(), solicitud.solicitanteId),
      estado: lookupName(this.estados(), solicitud.estadoId),
    }))
  );

  protected readonly filteredSolicitudes = computed(() => {
    const filters = this.filters();
    const role = this.currentRole();
    const currentPersonalId = this.currentPersonalId();

    return this.solicitudRows().filter((solicitud) => {
      const matchesEstado = filters.estado === 'Todos' || solicitud.estado === filters.estado;
      const matchesSector = filters.sector === 'Todos' || solicitud.sector === filters.sector;
      const matchesOficina = filters.oficina === 'Todas' || solicitud.oficina === filters.oficina;
      const matchesRole = role === 'administrador'
        || role === 'autorizador'
        || (role === 'operador' && solicitud.estado === 'Autorizada')
        || (role === 'solicitante' && currentPersonalId !== null && solicitud.solicitanteId === currentPersonalId);

      return matchesEstado && matchesSector && matchesOficina && matchesRole;
    });
  });

  protected readonly selectedSolicitud = computed(() => {
    const selectedId = this.selectedSolicitudId();
    return this.solicitudes().find((solicitud) => solicitud.id === selectedId) ?? null;
  });

  protected readonly totalSolicitudes = computed(() => this.solicitudRows().length);
  protected readonly pendientes = computed(() => this.solicitudRows().filter((solicitud) => solicitud.estado === 'Pendiente').length);
  protected readonly autorizadas = computed(() => this.solicitudRows().filter((solicitud) => solicitud.estado === 'Autorizada').length);
  protected readonly ejecutadas = computed(() => this.solicitudRows().filter((solicitud) => solicitud.estado === 'Ejecutada').length);

  protected readonly estadoOptions = computed(() => ['Todos', ...uniqueValues(this.estados().map((item) => item.nombre))]);
  protected readonly sectorOptions = computed(() => ['Todos', ...uniqueValues(this.sectores().map((item) => item.nombre))]);
  protected readonly oficinaOptions = computed(() => ['Todas', ...uniqueValues(this.oficinas().map((item) => item.nombre))]);

  protected readonly modeLabel = computed(() => (this.mode() === 'sqlite' ? 'SQLite local' : 'Demo local'));
  protected readonly selectedLabel = computed(() => {
    const selected = this.selectedSolicitud();

    if (!selected) {
      return 'Nueva solicitud';
    }

    return `Solicitud #${selected.id} · ${lookupName(this.sectores(), selected.sectorId)} · ${lookupName(this.estados(), selected.estadoId)}`;
  });

  protected readonly autorizacionesRows = computed<AutorizacionView[]>(() =>
    this.autorizaciones().map((autorizacion) => ({
      ...autorizacion,
      solicitud: `#${autorizacion.solicitudId} · ${this.solicitudes().find((item) => item.id === autorizacion.solicitudId)?.motivo ?? 'Sin solicitud'}`,
      oficina: lookupName(this.oficinas(), autorizacion.oficinaId),
      autorizador: lookupName(this.personal(), autorizacion.autorizadorId),
      estado: lookupName(this.estadosAutorizacion(), autorizacion.estadoId),
    }))
  );

  protected readonly filteredAutorizaciones = computed(() => {
    const role = this.currentRole();
    const currentPersonalId = this.currentPersonalId();
    const solicitudId = this.selectedSolicitudId();
    const baseRows = this.autorizacionesRows().filter((item) => {
      if (role === 'solicitante') {
        const solicitud = this.solicitudes().find((record) => record.id === item.solicitudId);
        return solicitud?.solicitanteId === currentPersonalId;
      }

      if (role === 'operador') {
        const solicitud = this.solicitudes().find((record) => record.id === item.solicitudId);
        return solicitud?.estadoId === 2;
      }

      return true;
    });

    return solicitudId === null ? baseRows : baseRows.filter((item) => item.solicitudId === solicitudId);
  });

  protected readonly selectedAutorizacion = computed(() => {
    const selectedId = this.selectedAutorizacionId();
    return this.autorizaciones().find((item) => item.id === selectedId) ?? null;
  });

  protected readonly totalAutorizaciones = computed(() => this.autorizacionesRows().length);
  protected readonly autorizacionesPendientes = computed(() => this.autorizacionesRows().filter((item) => item.estado === 'Pendiente').length);
  protected readonly autorizacionesAprobadas = computed(() => this.autorizacionesRows().filter((item) => item.estado === 'Autorizada').length);

  constructor(
    private readonly database: DatabaseService,
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
  ) {
    this.form = this.fb.group({
      id: [null as number | null],
      sectorId: [null as number | null, Validators.required],
      oficinaId: [null as number | null, Validators.required],
      solicitanteId: [null as number | null, Validators.required],
      fecha: ['', Validators.required],
      inicio: [''],
      fin: [''],
      motivo: ['', [Validators.required, Validators.minLength(5)]],
      estadoId: [null as number | null, Validators.required],
      observaciones: ['', [Validators.maxLength(500)]],
    }, { validators: [this.timeRangeValidator()] });

    this.authorizationForm = this.fb.group({
      id: [null as number | null],
      solicitudId: [null as number | null, Validators.required],
      oficinaId: [null as number | null, Validators.required],
      autorizadorId: [null as number | null, Validators.required],
      fecha: ['', Validators.required],
      inicio: [''],
      fin: [''],
      observaciones: ['', [Validators.maxLength(500)]],
      estadoId: [null as number | null, Validators.required],
    }, { validators: [this.timeRangeValidator('inicio', 'fin')] });
  }

  async ngOnInit(): Promise<void> {
    await this.reloadData();
  }

  protected setEstado(estado: string): void {
    this.filters.update((current) => ({ ...current, estado }));
  }

  protected setSector(sector: string): void {
    this.filters.update((current) => ({ ...current, sector }));
  }

  protected setOficina(oficina: string): void {
    this.filters.update((current) => ({ ...current, oficina }));
  }

  protected selectSolicitud(id: number): void {
    this.selectedSolicitudId.set(id);
    this.patchFormFromSelection(id);
    this.syncAutorizacionSelection(id);
  }

  protected newSolicitud(): void {
    this.selectedSolicitudId.set(null);
    const demoValue = buildDemoFormValue();
    this.form.reset({
      ...demoValue,
      solicitanteId: this.currentPersonalId() ?? demoValue.solicitanteId,
    });
    this.selectedAutorizacionId.set(null);
    this.authorizationForm.reset({
      id: null,
      solicitudId: null,
      oficinaId: null,
      autorizadorId: this.visiblePersonal()[0]?.id ?? null,
      fecha: todayIso(),
      inicio: '',
      fin: '',
      observaciones: '',
      estadoId: this.estadosAutorizacion()[0]?.id ?? null,
    });
    this.statusMessage.set('Nuevo registro listo para cargar');
  }

  protected selectAutorizacion(id: number): void {
    this.selectedAutorizacionId.set(id);
    const record = this.autorizaciones().find((item) => item.id === id);

    if (!record) {
      return;
    }

    this.authorizationForm.reset({
      id: record.id,
      solicitudId: record.solicitudId,
      oficinaId: record.oficinaId,
      autorizadorId: record.autorizadorId,
      fecha: record.fecha,
      inicio: record.inicio,
      fin: record.fin,
      observaciones: record.observaciones,
      estadoId: record.estadoId,
    });
  }

  protected newAutorizacion(): void {
    this.selectedAutorizacionId.set(null);
    this.authorizationForm.reset({
      id: null,
      solicitudId: this.selectedSolicitudId(),
      oficinaId: this.selectedSolicitud()?.oficinaId ?? null,
      autorizadorId: this.visiblePersonal()[0]?.id ?? null,
      fecha: todayIso(),
      inicio: '',
      fin: '',
      observaciones: '',
      estadoId: this.estadosAutorizacion()[0]?.id ?? null,
    });
    this.statusMessage.set('Nueva autorización lista para cargar');
  }

  protected async refresh(): Promise<void> {
    await this.reloadData(this.selectedSolicitudId());
  }

  protected logout(): void {
    this.auth.logout();
  }

  protected async saveSolicitud(): Promise<void> {
    if (!this.canManageSolicitudes()) {
      this.statusMessage.set('No tienes permiso para guardar solicitudes');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.statusMessage.set(this.formMessage());
      return;
    }

    const value = this.form.getRawValue() as SolicitudFormValue;
    const record = this.formValueToRecord(value);

    if (record.id !== null && this.selectedSolicitud()) {
      await this.updateSolicitud({ ...record, id: record.id });
      return;
    }

    await this.createSolicitud(record);
  }

  protected async deleteSolicitud(): Promise<void> {
    if (!this.canManageSolicitudes()) {
      this.statusMessage.set('No tienes permiso para eliminar solicitudes');
      return;
    }

    const selected = this.selectedSolicitud();

    if (!selected) {
      this.statusMessage.set('Selecciona una solicitud para eliminar');
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm(`Eliminar la solicitud #${selected.id}?`)) {
      return;
    }

    if (this.mode() === 'sqlite') {
      const result = await this.database.executeNonQuery('DELETE FROM Solicitudes WHERE SolicitudID = ?', [selected.id]);

      if (!result.success) {
        this.statusMessage.set(result.error ?? 'No se pudo eliminar la solicitud');
        return;
      }
    }

    this.solicitudes.update((items) => items.filter((item) => item.id !== selected.id));
    this.statusMessage.set(`Solicitud #${selected.id} eliminada`);
    this.syncSelectionAfterMutation();
  }

  protected async saveAutorizacion(): Promise<void> {
    if (!this.canManageAutorizaciones()) {
      this.statusMessage.set('No tienes permiso para guardar autorizaciones');
      return;
    }

    if (this.authorizationForm.invalid) {
      this.authorizationForm.markAllAsTouched();
      this.statusMessage.set(this.authorizationFormMessage());
      return;
    }

    const value = this.authorizationForm.getRawValue() as AutorizacionFormValue;
    const record = this.authorizationFormValueToRecord(value);

    if (record.id !== null && this.selectedAutorizacion()) {
      await this.updateAutorizacion({ ...record, id: record.id });
      return;
    }

    await this.createAutorizacion(record);
  }

  protected async deleteAutorizacion(): Promise<void> {
    if (!this.canManageAutorizaciones()) {
      this.statusMessage.set('No tienes permiso para eliminar autorizaciones');
      return;
    }

    const selected = this.selectedAutorizacion();

    if (!selected) {
      this.statusMessage.set('Selecciona una autorización para eliminar');
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm(`Eliminar la autorización #${selected.id}?`)) {
      return;
    }

    if (this.mode() === 'sqlite') {
      const result = await this.database.executeNonQuery('DELETE FROM Autorizaciones WHERE AutorizacionID = ?', [selected.id]);

      if (!result.success) {
        this.statusMessage.set(result.error ?? 'No se pudo eliminar la autorización');
        return;
      }
    }

    this.autorizaciones.update((items) => items.filter((item) => item.id !== selected.id));
    this.statusMessage.set(`Autorización #${selected.id} eliminada`);
    this.selectedAutorizacionId.set(null);
    this.newAutorizacion();
  }

  protected statusClass(estado: string): string {
    return `status--${estado.toLowerCase()}`;
  }

  protected hasFieldError(name: string): boolean {
    const control = this.form.get(name);
    return !!control && control.touched && control.invalid;
  }

  protected fieldError(name: string): string {
    const control = this.form.get(name);

    if (!control || !control.touched || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'Este campo es obligatorio.';
    }

    if (control.errors['minlength']) {
      return 'Debe tener al menos 5 caracteres.';
    }

    if (control.errors['maxlength']) {
      return 'Supera el máximo permitido.';
    }

    return 'Valor inválido.';
  }

  protected formError(): string {
    return this.form.errors?.['invalidTimeRange'] ? 'La hora fin debe ser mayor que la hora inicio.' : '';
  }

  protected hasAuthorizationFieldError(name: string): boolean {
    const control = this.authorizationForm.get(name);
    return !!control && control.touched && control.invalid;
  }

  protected authorizationFieldError(name: string): string {
    const control = this.authorizationForm.get(name);

    if (!control || !control.touched || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'Este campo es obligatorio.';
    }

    if (control.errors['maxlength']) {
      return 'Supera el máximo permitido.';
    }

    return 'Valor inválido.';
  }

  protected authorizationFormError(): string {
    return this.authorizationForm.errors?.['invalidTimeRange'] ? 'La hora fin autorizada debe ser mayor que la hora inicio.' : '';
  }

  private async reloadData(preferredId: number | null = this.selectedSolicitudId()): Promise<void> {
    this.isBusy.set(true);
    this.statusMessage.set('Cargando datos');

    const loaded = await this.loadFromDatabase();

    if (!loaded) {
      this.loadDemoState();
    }

    this.selectDefaultRecord(preferredId);
    this.syncAutorizacionSelection(this.selectedSolicitudId());
    this.updateFormAccess();
    this.isBusy.set(false);
  }

  private async loadFromDatabase(): Promise<boolean> {
    const [sectores, oficinas, personal, estados, estadosAutorizacion, solicitudes, autorizaciones] = await Promise.all([
      this.database.executeQuery(QUERY_SECTORES),
      this.database.executeQuery(QUERY_OFICINAS),
      this.database.executeQuery(QUERY_PERSONAL),
      this.database.executeQuery(QUERY_ESTADOS),
      this.database.executeQuery(QUERY_ESTADOS_AUTORIZACION),
      this.database.executeQuery(QUERY_SOLICITUDES),
      this.database.executeQuery(QUERY_AUTORIZACIONES),
    ]);

    if (![sectores, oficinas, personal, estados, estadosAutorizacion, solicitudes, autorizaciones].every((result) => result.success && Array.isArray(result.data))) {
      return false;
    }

    this.mode.set('sqlite');
    this.sectores.set(this.mapLookup(sectores.data ?? []));
    this.oficinas.set(this.mapLookup(oficinas.data ?? []));
    this.personal.set(this.mapLookup(personal.data ?? []));
    this.estados.set(this.mapLookup(estados.data ?? []));
    this.estadosAutorizacion.set(this.mapLookup(estadosAutorizacion.data ?? []));
    this.solicitudes.set(this.mapSolicitudes(solicitudes.data ?? []));
    this.autorizaciones.set(this.mapAutorizaciones(autorizaciones.data ?? []));
    this.statusMessage.set('Datos cargados desde SQLite');

    return true;
  }

  private loadDemoState(): void {
    this.mode.set('demo');
    this.sectores.set(DEMO_SECTORES);
    this.oficinas.set(DEMO_OFICINAS);
    this.personal.set(DEMO_PERSONAL);
    this.estados.set(DEMO_ESTADOS);
    this.estadosAutorizacion.set(DEMO_ESTADOS_AUTORIZACION);
    this.solicitudes.set(DEMO_SOLICITUDES);
    this.autorizaciones.set(DEMO_AUTORIZACIONES);
    this.statusMessage.set('Modo demo local activado');
  }

  private selectDefaultRecord(preferredId: number | null): void {
    const records = this.filteredSolicitudes();

    if (records.length === 0) {
      this.selectedSolicitudId.set(null);
      const demoValue = buildDemoFormValue();
      this.form.reset({
        ...demoValue,
        solicitanteId: this.currentPersonalId() ?? demoValue.solicitanteId,
      });
      this.updateFormAccess();
      return;
    }

    const selected = preferredId === null
      ? records[0]
      : records.find((record) => record.id === preferredId) ?? records[0];

    this.selectedSolicitudId.set(selected.id);
    this.patchFormFromRecord(selected);
    this.syncAutorizacionSelection(selected.id);
  }

  private syncAutorizacionSelection(solicitudId: number | null): void {
    const records = this.filteredAutorizaciones();

    if (records.length === 0) {
      this.selectedAutorizacionId.set(null);
      this.authorizationForm.reset({
        id: null,
        solicitudId,
        oficinaId: this.selectedSolicitud()?.oficinaId ?? null,
        autorizadorId: this.visiblePersonal()[0]?.id ?? null,
        fecha: todayIso(),
        inicio: '',
        fin: '',
        observaciones: '',
        estadoId: this.estadosAutorizacion()[0]?.id ?? null,
      });
      return;
    }

    const selected = records[0];
    this.selectedAutorizacionId.set(selected.id);
    this.authorizationForm.reset({
      id: selected.id,
      solicitudId: selected.solicitudId,
      oficinaId: selected.oficinaId,
      autorizadorId: selected.autorizadorId,
      fecha: selected.fecha,
      inicio: selected.inicio,
      fin: selected.fin,
      observaciones: selected.observaciones,
      estadoId: selected.estadoId,
    });
  }

  private patchFormFromSelection(id: number): void {
    const record = this.solicitudes().find((item) => item.id === id);

    if (!record) {
      return;
    }

    this.patchFormFromRecord(record);
  }

  private patchFormFromRecord(record: SolicitudRecord): void {
    this.form.reset({
      id: record.id,
      sectorId: record.sectorId,
      oficinaId: record.oficinaId,
      solicitanteId: record.solicitanteId,
      fecha: record.fecha,
      inicio: record.inicio,
      fin: record.fin,
      motivo: record.motivo,
      estadoId: record.estadoId,
      observaciones: record.observaciones,
    });
  }

  private formValueToRecord(value: SolicitudFormValue): SolicitudDraft {
    return {
      id: value.id,
      sectorId: toNumber(value.sectorId) ?? 0,
      oficinaId: toNumber(value.oficinaId) ?? 0,
      solicitanteId: toNumber(value.solicitanteId) ?? 0,
      fecha: value.fecha,
      inicio: normalizeTime(value.inicio),
      fin: normalizeTime(value.fin),
      motivo: normalizeText(value.motivo),
      estadoId: toNumber(value.estadoId) ?? 0,
      observaciones: normalizeText(value.observaciones),
    };
  }

  private timeRangeValidator(startField = 'inicio', endField = 'fin'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const inicio = String(control.get(startField)?.value ?? '');
      const fin = String(control.get(endField)?.value ?? '');

      if (!inicio || !fin) {
        return null;
      }

      const start = timeToMinutes(inicio);
      const end = timeToMinutes(fin);

      if (start === null || end === null || end > start) {
        return null;
      }

      return { invalidTimeRange: true };
    };
  }

  private formMessage(): string {
    if (this.form.errors?.['invalidTimeRange']) {
      return 'Revisa la hora inicio y fin.';
    }

    return 'Completa los campos obligatorios.';
  }

  protected authorizationFormMessage(): string {
    if (this.authorizationForm.errors?.['invalidTimeRange']) {
      return 'Revisa la hora autorizada.';
    }

    return 'Completa los campos obligatorios de la autorización.';
  }

  private primaryRole(roles: string[]): 'administrador' | 'autorizador' | 'operador' | 'solicitante' {
    if (roles.length === 0) {
      return 'administrador';
    }

    if (roles.includes('administrador')) {
      return 'administrador';
    }

    if (roles.includes('autorizador')) {
      return 'autorizador';
    }

    if (roles.includes('operador')) {
      return 'operador';
    }

    return 'solicitante';
  }

  private currentUserIdValue(): number {
    return this.currentSession()?.userId ?? 1;
  }

  private updateFormAccess(): void {
    if (this.canManageSolicitudes()) {
      this.form.enable({ emitEvent: false });
    } else {
      this.form.disable({ emitEvent: false });
    }

    if (this.canManageAutorizaciones()) {
      this.authorizationForm.enable({ emitEvent: false });
    } else {
      this.authorizationForm.disable({ emitEvent: false });
    }
  }

  private async createSolicitud(record: SolicitudDraft): Promise<void> {
    if (this.mode() === 'sqlite') {
      const result = await this.database.executeNonQuery(
        `
          INSERT INTO Solicitudes (
            SectorID,
            OficinaID,
            SolicitanteID,
            FechaSolicitud,
            HoraInicioPrevista,
            HoraFinPrevista,
            Motivo,
            EstadoID,
            Observaciones,
            UsuarioCreadorID,
            FechaCreacion,
            UsuarioModificadorID,
            FechaModificacion
          ) VALUES (
            @sectorId,
            @oficinaId,
            @solicitanteId,
            @fecha,
            @inicio,
            @fin,
            @motivo,
            @estadoId,
            @observaciones,
            @usuarioCreadorId,
            CURRENT_TIMESTAMP,
            NULL,
            NULL
          )
        `,
        {
          sectorId: record.sectorId,
          oficinaId: record.oficinaId,
          solicitanteId: record.solicitanteId,
          fecha: record.fecha,
          inicio: record.inicio || null,
          fin: record.fin || null,
          motivo: record.motivo,
          estadoId: record.estadoId,
          observaciones: record.observaciones,
          usuarioCreadorId: this.currentUserIdValue(),
        }
      );

      if (!result.success) {
        this.statusMessage.set(result.error ?? 'No se pudo crear la solicitud');
        return;
      }

      await this.reloadData(Number(result.lastInsertRowid ?? 0));
      this.statusMessage.set('Solicitud creada');
      return;
    }

    const nextId = (this.solicitudes().reduce((max, item) => Math.max(max, item.id), 0) || 1041) + 1;
    const created: SolicitudRecord = { ...record, id: nextId };

    this.solicitudes.update((items) => [created, ...items]);
    this.selectDefaultRecord(nextId);
    this.statusMessage.set(`Solicitud #${nextId} creada`);
  }

  private authorizationFormValueToRecord(value: AutorizacionFormValue): AutorizacionDraft {
    return {
      id: value.id,
      solicitudId: toNumber(value.solicitudId) ?? 0,
      oficinaId: toNumber(value.oficinaId) ?? 0,
      autorizadorId: toNumber(value.autorizadorId) ?? 0,
      fecha: value.fecha,
      inicio: normalizeTime(value.inicio),
      fin: normalizeTime(value.fin),
      observaciones: normalizeText(value.observaciones),
      estadoId: toNumber(value.estadoId) ?? 0,
    };
  }

  private async createAutorizacion(record: AutorizacionDraft): Promise<void> {
    if (this.mode() === 'sqlite') {
      const result = await this.database.executeNonQuery(
        `
          INSERT INTO Autorizaciones (
            SolicitudID,
            OficinaID,
            AutorizadorID,
            FechaAutorizacion,
            HoraInicioAutorizada,
            HoraFinAutorizada,
            Observaciones,
            EstadoID,
            UsuarioCreadorID,
            FechaCreacion,
            UsuarioModificadorID,
            FechaModificacion
          ) VALUES (
            @solicitudId,
            @oficinaId,
            @autorizadorId,
            @fecha,
            @inicio,
            @fin,
            @observaciones,
            @estadoId,
            @usuarioCreadorId,
            CURRENT_TIMESTAMP,
            NULL,
            NULL
          )
        `,
        {
          solicitudId: record.solicitudId,
          oficinaId: record.oficinaId,
          autorizadorId: record.autorizadorId,
          fecha: record.fecha,
          inicio: record.inicio || null,
          fin: record.fin || null,
          observaciones: record.observaciones,
          estadoId: record.estadoId,
          usuarioCreadorId: this.currentUserIdValue(),
        }
      );

      if (!result.success) {
        this.statusMessage.set(result.error ?? 'No se pudo crear la autorización');
        return;
      }

      await this.reloadData(record.solicitudId);
      this.statusMessage.set('Autorización creada');
      return;
    }

    const nextId = (this.autorizaciones().reduce((max, item) => Math.max(max, item.id), 0) || 2000) + 1;
    const created: AutorizacionRecord = { ...record, id: nextId };

    this.autorizaciones.update((items) => [created, ...items]);
    this.selectedAutorizacionId.set(nextId);
    this.authorizationForm.reset({
      id: nextId,
      solicitudId: created.solicitudId,
      oficinaId: created.oficinaId,
      autorizadorId: created.autorizadorId,
      fecha: created.fecha,
      inicio: created.inicio,
      fin: created.fin,
      observaciones: created.observaciones,
      estadoId: created.estadoId,
    });
    this.statusMessage.set(`Autorización #${nextId} creada`);
  }

  private async updateSolicitud(record: SolicitudRecord): Promise<void> {
    if (this.mode() === 'sqlite') {
      const result = await this.database.executeNonQuery(
        `
          UPDATE Solicitudes
          SET
            SectorID = @sectorId,
            OficinaID = @oficinaId,
            SolicitanteID = @solicitanteId,
            FechaSolicitud = @fecha,
            HoraInicioPrevista = @inicio,
            HoraFinPrevista = @fin,
            Motivo = @motivo,
            EstadoID = @estadoId,
            Observaciones = @observaciones,
            UsuarioModificadorID = @usuarioModificadorId,
            FechaModificacion = CURRENT_TIMESTAMP
          WHERE SolicitudID = @id
        `,
        {
          id: record.id,
          sectorId: record.sectorId,
          oficinaId: record.oficinaId,
          solicitanteId: record.solicitanteId,
          fecha: record.fecha,
          inicio: record.inicio || null,
          fin: record.fin || null,
          motivo: record.motivo,
          estadoId: record.estadoId,
          observaciones: record.observaciones,
          usuarioModificadorId: this.currentUserIdValue(),
        }
      );

      if (!result.success) {
        this.statusMessage.set(result.error ?? 'No se pudo actualizar la solicitud');
        return;
      }

      await this.reloadData(record.id);
      this.statusMessage.set(`Solicitud #${record.id} actualizada`);
      return;
    }

    this.solicitudes.update((items) => items.map((item) => (item.id === record.id ? record : item)));
    this.selectDefaultRecord(record.id);
    this.statusMessage.set(`Solicitud #${record.id} actualizada`);
  }

  private async updateAutorizacion(record: AutorizacionRecord): Promise<void> {
    if (this.mode() === 'sqlite') {
      const result = await this.database.executeNonQuery(
        `
          UPDATE Autorizaciones
          SET
            SolicitudID = @solicitudId,
            OficinaID = @oficinaId,
            AutorizadorID = @autorizadorId,
            FechaAutorizacion = @fecha,
            HoraInicioAutorizada = @inicio,
            HoraFinAutorizada = @fin,
            Observaciones = @observaciones,
            EstadoID = @estadoId,
            UsuarioModificadorID = @usuarioModificadorId,
            FechaModificacion = CURRENT_TIMESTAMP
          WHERE AutorizacionID = @id
        `,
        {
          id: record.id,
          solicitudId: record.solicitudId,
          oficinaId: record.oficinaId,
          autorizadorId: record.autorizadorId,
          fecha: record.fecha,
          inicio: record.inicio || null,
          fin: record.fin || null,
          observaciones: record.observaciones,
          estadoId: record.estadoId,
          usuarioModificadorId: this.currentUserIdValue(),
        }
      );

      if (!result.success) {
        this.statusMessage.set(result.error ?? 'No se pudo actualizar la autorización');
        return;
      }

      await this.reloadData(record.id);
      this.statusMessage.set(`Autorización #${record.id} actualizada`);
      return;
    }

    this.autorizaciones.update((items) => items.map((item) => (item.id === record.id ? record : item)));
    this.selectedAutorizacionId.set(record.id);
    this.statusMessage.set(`Autorización #${record.id} actualizada`);
  }

  private syncSelectionAfterMutation(): void {
    const remaining = this.solicitudes();

    if (remaining.length === 0) {
      this.newSolicitud();
      return;
    }

    this.selectDefaultRecord(remaining[0].id);
  }

  private mapLookup(rows: any[]): LookupItem[] {
    return rows.map((row) => ({
      id: Number(row.id),
      nombre: String(row.nombre ?? ''),
    }));
  }

  private mapSolicitudes(rows: any[]): SolicitudRecord[] {
    return rows.map((row) => ({
      id: Number(row.id),
      sectorId: Number(row.sectorId),
      oficinaId: Number(row.oficinaId),
      solicitanteId: Number(row.solicitanteId),
      fecha: String(row.fecha ?? ''),
      inicio: String(row.inicio ?? ''),
      fin: String(row.fin ?? ''),
      motivo: String(row.motivo ?? ''),
      estadoId: Number(row.estadoId),
      observaciones: String(row.observaciones ?? ''),
    }));
  }

  private mapAutorizaciones(rows: any[]): AutorizacionRecord[] {
    return rows.map((row) => ({
      id: Number(row.id),
      solicitudId: Number(row.solicitudId),
      oficinaId: Number(row.oficinaId),
      autorizadorId: Number(row.autorizadorId),
      fecha: String(row.fecha ?? ''),
      inicio: String(row.inicio ?? ''),
      fin: String(row.fin ?? ''),
      observaciones: String(row.observaciones ?? ''),
      estadoId: Number(row.estadoId),
    }));
  }
}
