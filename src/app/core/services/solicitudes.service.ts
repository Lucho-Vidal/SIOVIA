import { Injectable, signal } from '@angular/core';
import { DatabaseService } from '../database/database.service';

export interface SolicitudRecord {
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

export interface SolicitudView extends SolicitudRecord {
  sector: string;
  oficina: string;
  solicitante: string;
  estado: string;
}

@Injectable({
  providedIn: 'root'
})
export class SolicitudesService {
  private readonly isElectron = typeof window !== 'undefined' && !!window.electronAPI?.executeQuery;

  readonly solicitudes = signal<SolicitudRecord[]>([]);

  private readonly QUERY_SOLICITUDES = `
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

  constructor(private readonly database: DatabaseService) {}

  async loadAll(): Promise<boolean> {
    if (!this.isElectron) {
      return false;
    }

    const result = await this.database.executeQuery(this.QUERY_SOLICITUDES);

    if (!result.success || !Array.isArray(result.data)) {
      return false;
    }

    this.solicitudes.set(this.mapSolicitudes(result.data));
    return true;
  }

  async create(record: Omit<SolicitudRecord, 'id'>, usuarioCreadorId: number): Promise<{ success: boolean; id?: number; error?: string }> {
    if (!this.isElectron) {
      return { success: false, error: 'Database not available' };
    }

    const result = await this.database.executeNonQuery(
      `INSERT INTO Solicitudes (
        SectorID, OficinaID, SolicitanteID, FechaSolicitud,
        HoraInicioPrevista, HoraFinPrevista, Motivo, EstadoID,
        Observaciones, UsuarioCreadorID, FechaCreacion
      ) VALUES (
        @sectorId, @oficinaId, @solicitanteId, @fecha,
        @inicio, @fin, @motivo, @estadoId,
        @observaciones, @usuarioCreadorId, CURRENT_TIMESTAMP
      )`,
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
        usuarioCreadorId,
      }
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    await this.loadAll();
    return { success: true, id: Number(result.lastInsertRowid ?? 0) };
  }

  async update(record: SolicitudRecord, usuarioModificadorId: number): Promise<{ success: boolean; error?: string }> {
    if (!this.isElectron) {
      return { success: false, error: 'Database not available' };
    }

    const result = await this.database.executeNonQuery(
      `UPDATE Solicitudes SET
        SectorID = @sectorId, OficinaID = @oficinaId, SolicitanteID = @solicitanteId,
        FechaSolicitud = @fecha, HoraInicioPrevista = @inicio, HoraFinPrevista = @fin,
        Motivo = @motivo, EstadoID = @estadoId, Observaciones = @observaciones,
        UsuarioModificadorID = @usuarioModificadorId, FechaModificacion = CURRENT_TIMESTAMP
      WHERE SolicitudID = @id`,
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
        usuarioModificadorId,
      }
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    await this.loadAll();
    return { success: true };
  }

  async delete(id: number): Promise<{ success: boolean; error?: string }> {
    if (!this.isElectron) {
      return { success: false, error: 'Database not available' };
    }

    const result = await this.database.executeNonQuery('DELETE FROM Solicitudes WHERE SolicitudID = ?', [id]);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    await this.loadAll();
    return { success: true };
  }

  toView(records: SolicitudRecord[], lookupFn: (items: { id: number; nombre: string }[], id: number | null) => string, sectores: { id: number; nombre: string }[], oficinas: { id: number; nombre: string }[], personal: { id: number; nombre: string }[], estados: { id: number; nombre: string }[]): SolicitudView[] {
    return records.map((s) => ({
      ...s,
      sector: lookupFn(sectores, s.sectorId),
      oficina: lookupFn(oficinas, s.oficinaId),
      solicitante: lookupFn(personal, s.solicitanteId),
      estado: lookupFn(estados, s.estadoId),
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
