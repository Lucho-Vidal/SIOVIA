import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

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

const CURRENT_USER_ID = 1;

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
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly mode = signal<'demo' | 'sqlite'>('demo');
  protected readonly isBusy = signal(false);
  protected readonly statusMessage = signal('Listo para trabajar');

  protected readonly sectores = signal<LookupItem[]>(DEMO_SECTORES);
  protected readonly oficinas = signal<LookupItem[]>(DEMO_OFICINAS);
  protected readonly personal = signal<LookupItem[]>(DEMO_PERSONAL);
  protected readonly estados = signal<LookupItem[]>(DEMO_ESTADOS);
  protected readonly solicitudes = signal<SolicitudRecord[]>(DEMO_SOLICITUDES);
  protected readonly selectedSolicitudId = signal<number | null>(DEMO_SOLICITUDES[0]?.id ?? null);

  protected readonly filters = signal({
    estado: 'Todos',
    sector: 'Todos',
    oficina: 'Todas',
  });

  readonly form: FormGroup;

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

    return this.solicitudRows().filter((solicitud) => {
      const matchesEstado = filters.estado === 'Todos' || solicitud.estado === filters.estado;
      const matchesSector = filters.sector === 'Todos' || solicitud.sector === filters.sector;
      const matchesOficina = filters.oficina === 'Todas' || solicitud.oficina === filters.oficina;

      return matchesEstado && matchesSector && matchesOficina;
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

  constructor(
    private readonly database: DatabaseService,
    private readonly fb: FormBuilder,
  ) {
    this.form = this.fb.group({
      id: [null as number | null],
      sectorId: [null as number | null, Validators.required],
      oficinaId: [null as number | null, Validators.required],
      solicitanteId: [null as number | null, Validators.required],
      fecha: ['', Validators.required],
      inicio: [''],
      fin: [''],
      motivo: ['', Validators.required],
      estadoId: [null as number | null, Validators.required],
      observaciones: [''],
    });
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
  }

  protected newSolicitud(): void {
    this.selectedSolicitudId.set(null);
    this.form.reset(buildDemoFormValue());
    this.statusMessage.set('Nuevo registro listo para cargar');
  }

  protected async refresh(): Promise<void> {
    await this.reloadData(this.selectedSolicitudId());
  }

  protected async saveSolicitud(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.statusMessage.set('Completa los campos obligatorios');
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

  protected statusClass(estado: string): string {
    return `status--${estado.toLowerCase()}`;
  }

  private async reloadData(preferredId: number | null = this.selectedSolicitudId()): Promise<void> {
    this.isBusy.set(true);
    this.statusMessage.set('Cargando datos');

    const loaded = await this.loadFromDatabase();

    if (!loaded) {
      this.loadDemoState();
    }

    this.selectDefaultRecord(preferredId);
    this.isBusy.set(false);
  }

  private async loadFromDatabase(): Promise<boolean> {
    const [sectores, oficinas, personal, estados, solicitudes] = await Promise.all([
      this.database.executeQuery(QUERY_SECTORES),
      this.database.executeQuery(QUERY_OFICINAS),
      this.database.executeQuery(QUERY_PERSONAL),
      this.database.executeQuery(QUERY_ESTADOS),
      this.database.executeQuery(QUERY_SOLICITUDES),
    ]);

    if (![sectores, oficinas, personal, estados, solicitudes].every((result) => result.success && Array.isArray(result.data))) {
      return false;
    }

    this.mode.set('sqlite');
    this.sectores.set(this.mapLookup(sectores.data ?? []));
    this.oficinas.set(this.mapLookup(oficinas.data ?? []));
    this.personal.set(this.mapLookup(personal.data ?? []));
    this.estados.set(this.mapLookup(estados.data ?? []));
    this.solicitudes.set(this.mapSolicitudes(solicitudes.data ?? []));
    this.statusMessage.set('Datos cargados desde SQLite');

    return true;
  }

  private loadDemoState(): void {
    this.mode.set('demo');
    this.sectores.set(DEMO_SECTORES);
    this.oficinas.set(DEMO_OFICINAS);
    this.personal.set(DEMO_PERSONAL);
    this.estados.set(DEMO_ESTADOS);
    this.solicitudes.set(DEMO_SOLICITUDES);
    this.statusMessage.set('Modo demo local activado');
  }

  private selectDefaultRecord(preferredId: number | null): void {
    const records = this.solicitudes();

    if (records.length === 0) {
      this.selectedSolicitudId.set(null);
      this.form.reset(buildDemoFormValue());
      return;
    }

    const selected = preferredId === null
      ? records[0]
      : records.find((record) => record.id === preferredId) ?? records[0];

    this.selectedSolicitudId.set(selected.id);
    this.patchFormFromRecord(selected);
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
      sectorId: value.sectorId ?? 0,
      oficinaId: value.oficinaId ?? 0,
      solicitanteId: value.solicitanteId ?? 0,
      fecha: value.fecha,
      inicio: normalizeTime(value.inicio),
      fin: normalizeTime(value.fin),
      motivo: normalizeText(value.motivo),
      estadoId: value.estadoId ?? 0,
      observaciones: normalizeText(value.observaciones),
    };
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
          usuarioCreadorId: CURRENT_USER_ID,
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
          usuarioModificadorId: CURRENT_USER_ID,
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
}
