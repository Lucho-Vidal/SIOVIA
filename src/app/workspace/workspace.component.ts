import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

import { AuthService } from '../core/auth/auth.service';
import { SharedDataService, LookupItem } from '../core/services/shared-data.service';
import { SolicitudesService, SolicitudRecord, SolicitudView } from '../core/services/solicitudes.service';
import { AutorizacionesService, AutorizacionRecord } from '../core/services/autorizaciones.service';

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
  if (!value) return null;
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};
const lookupName = (items: LookupItem[], id: number | null): string => {
  if (id === null) return 'Sin dato';
  return items.find((item) => item.id === id)?.nombre ?? 'Sin dato';
};
const uniqueValues = (items: string[]): string[] => Array.from(new Set(items));

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.scss'
})
export class WorkspaceComponent implements OnInit {
  protected readonly mode = signal<'demo' | 'sqlite'>('demo');
  protected readonly isBusy = signal(false);
  protected readonly statusMessage = signal('Listo para trabajar');
  protected readonly currentSession = computed(() => this.auth.session());

  protected readonly sectores = signal<LookupItem[]>([]);
  protected readonly oficinas = signal<LookupItem[]>([]);
  protected readonly personal = signal<LookupItem[]>([]);
  protected readonly estados = signal<LookupItem[]>([]);
  protected readonly estadosAutorizacion = signal<LookupItem[]>([]);
  protected readonly solicitudes = signal<SolicitudRecord[]>([]);
  protected readonly autorizaciones = signal<AutorizacionRecord[]>([]);
  protected readonly selectedSolicitudId = signal<number | null>(null);
  protected readonly selectedAutorizacionId = signal<number | null>(null);

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
    this.solicitudesService.toView(
      this.solicitudes(),
      lookupName,
      this.sectores(),
      this.oficinas(),
      this.personal(),
      this.estados()
    )
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
  protected readonly pendientes = computed(() => this.solicitudRows().filter((s) => s.estado === 'Pendiente').length);
  protected readonly autorizadas = computed(() => this.solicitudRows().filter((s) => s.estado === 'Autorizada').length);
  protected readonly ejecutadas = computed(() => this.solicitudRows().filter((s) => s.estado === 'Ejecutada').length);

  protected readonly estadoOptions = computed(() => ['Todos', ...uniqueValues(this.estados().map((item) => item.nombre))]);
  protected readonly sectorOptions = computed(() => ['Todos', ...uniqueValues(this.sectores().map((item) => item.nombre))]);
  protected readonly oficinaOptions = computed(() => ['Todas', ...uniqueValues(this.oficinas().map((item) => item.nombre))]);

  protected readonly modeLabel = computed(() => (this.mode() === 'sqlite' ? 'SQLite local' : 'Demo local'));
  protected readonly selectedLabel = computed(() => {
    const selected = this.selectedSolicitud();
    if (!selected) return 'Nueva solicitud';
    return `Solicitud #${selected.id} · ${lookupName(this.sectores(), selected.sectorId)} · ${lookupName(this.estados(), selected.estadoId)}`;
  });

  protected readonly autorizacionesRows = computed(() =>
    this.autorizaciones().map((a) => ({
      ...a,
      solicitud: `#${a.solicitudId} · ${this.solicitudes().find((item) => item.id === a.solicitudId)?.motivo ?? 'Sin solicitud'}`,
      oficina: lookupName(this.oficinas(), a.oficinaId),
      autorizador: lookupName(this.personal(), a.autorizadorId),
      estado: lookupName(this.estadosAutorizacion(), a.estadoId),
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
    private readonly sharedData: SharedDataService,
    private readonly solicitudesService: SolicitudesService,
    private readonly autorizacionesService: AutorizacionesService,
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
    this.form.reset({
      id: null,
      sectorId: this.sectores()[0]?.id ?? null,
      oficinaId: this.oficinas()[0]?.id ?? null,
      solicitanteId: this.currentPersonalId() ?? this.personal()[0]?.id ?? null,
      fecha: todayIso(),
      inicio: '',
      fin: '',
      motivo: '',
      estadoId: this.estados()[0]?.id ?? null,
      observaciones: '',
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
    if (!record) return;

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
    const record = {
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
      const result = await this.solicitudesService.delete(selected.id);
      if (!result.success) {
        this.statusMessage.set(result.error ?? 'No se pudo eliminar la solicitud');
        return;
      }
    } else {
      this.solicitudes.update((items) => items.filter((item) => item.id !== selected.id));
    }

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
    const record = {
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
      const result = await this.autorizacionesService.delete(selected.id);
      if (!result.success) {
        this.statusMessage.set(result.error ?? 'No se pudo eliminar la autorización');
        return;
      }
    } else {
      this.autorizaciones.update((items) => items.filter((item) => item.id !== selected.id));
    }

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
    if (!control || !control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Este campo es obligatorio.';
    if (control.errors['minlength']) return 'Debe tener al menos 5 caracteres.';
    if (control.errors['maxlength']) return 'Supera el máximo permitido.';
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
    if (!control || !control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Este campo es obligatorio.';
    if (control.errors['maxlength']) return 'Supera el máximo permitido.';
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
    const [sharedLoaded, solicitudesLoaded, autorizacionesLoaded] = await Promise.all([
      this.sharedData.loadAll(),
      this.solicitudesService.loadAll(),
      this.autorizacionesService.loadAll(),
    ]);

    if (!sharedLoaded || !solicitudesLoaded || !autorizacionesLoaded) {
      return false;
    }

    this.mode.set('sqlite');
    this.sectores.set(this.sharedData.sectores());
    this.oficinas.set(this.sharedData.oficinas());
    this.personal.set(this.sharedData.personal());
    this.estados.set(this.sharedData.estados());
    this.estadosAutorizacion.set(this.sharedData.estadosAutorizacion());
    this.solicitudes.set(this.solicitudesService.solicitudes());
    this.autorizaciones.set(this.autorizacionesService.autorizaciones());
    this.statusMessage.set('Datos cargados desde SQLite');

    return true;
  }

  private loadDemoState(): void {
    this.mode.set('demo');
    this.statusMessage.set('Modo demo local activado');
  }

  private selectDefaultRecord(preferredId: number | null): void {
    const records = this.filteredSolicitudes();
    if (records.length === 0) {
      this.selectedSolicitudId.set(null);
      this.form.reset({
        id: null,
        sectorId: this.sectores()[0]?.id ?? null,
        oficinaId: this.oficinas()[0]?.id ?? null,
        solicitanteId: this.currentPersonalId() ?? this.personal()[0]?.id ?? null,
        fecha: todayIso(),
        inicio: '',
        fin: '',
        motivo: '',
        estadoId: this.estados()[0]?.id ?? null,
        observaciones: '',
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
    if (!record) return;
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

  private timeRangeValidator(startField = 'inicio', endField = 'fin'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const inicio = String(control.get(startField)?.value ?? '');
      const fin = String(control.get(endField)?.value ?? '');
      if (!inicio || !fin) return null;

      const start = timeToMinutes(inicio);
      const end = timeToMinutes(fin);
      if (start === null || end === null || end > start) return null;

      return { invalidTimeRange: true };
    };
  }

  private formMessage(): string {
    if (this.form.errors?.['invalidTimeRange']) return 'Revisa la hora inicio y fin.';
    return 'Completa los campos obligatorios.';
  }

  protected authorizationFormMessage(): string {
    if (this.authorizationForm.errors?.['invalidTimeRange']) return 'Revisa la hora autorizada.';
    return 'Completa los campos obligatorios de la autorización.';
  }

  private primaryRole(roles: string[]): 'administrador' | 'autorizador' | 'operador' | 'solicitante' {
    if (roles.length === 0) return 'administrador';
    if (roles.includes('administrador')) return 'administrador';
    if (roles.includes('autorizador')) return 'autorizador';
    if (roles.includes('operador')) return 'operador';
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

  private async createSolicitud(record: Omit<SolicitudRecord, 'id'>): Promise<void> {
    if (this.mode() === 'sqlite') {
      const result = await this.solicitudesService.create(record, this.currentUserIdValue());
      if (!result.success) {
        this.statusMessage.set(result.error ?? 'No se pudo crear la solicitud');
        return;
      }
      await this.reloadData(Number(result.id ?? 0));
      this.statusMessage.set('Solicitud creada');
      return;
    }

    const nextId = (this.solicitudes().reduce((max, item) => Math.max(max, item.id), 0) || 1041) + 1;
    const created: SolicitudRecord = { ...record, id: nextId };
    this.solicitudes.update((items) => [created, ...items]);
    this.selectDefaultRecord(nextId);
    this.statusMessage.set(`Solicitud #${nextId} creada`);
  }

  private async createAutorizacion(record: Omit<AutorizacionRecord, 'id'>): Promise<void> {
    if (this.mode() === 'sqlite') {
      const result = await this.autorizacionesService.create(record, this.currentUserIdValue());
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
      const result = await this.solicitudesService.update(record, this.currentUserIdValue());
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
      const result = await this.autorizacionesService.update(record, this.currentUserIdValue());
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
}
