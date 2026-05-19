import { Injectable, signal } from '@angular/core';
import { DatabaseService } from '../database/database.service';

export interface AutorizacionRecord {
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

export interface AutorizacionView extends AutorizacionRecord {
  solicitud: string;
  oficina: string;
  autorizador: string;
  estado: string;
}

@Injectable({
  providedIn: 'root'
})
export class AutorizacionesService {
  private readonly isElectron = typeof window !== 'undefined' && !!window.electronAPI?.executeQuery;

  readonly autorizaciones = signal<AutorizacionRecord[]>([]);

  private readonly QUERY_AUTORIZACIONES = `
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

  constructor(private readonly database: DatabaseService) {}

  async loadAll(): Promise<boolean> {
    if (!this.isElectron) {
      return false;
    }

    const result = await this.database.executeQuery(this.QUERY_AUTORIZACIONES);

    if (!result.success || !Array.isArray(result.data)) {
      return false;
    }

    this.autorizaciones.set(this.mapAutorizaciones(result.data));
    return true;
  }

  async create(record: Omit<AutorizacionRecord, 'id'>, usuarioCreadorId: number): Promise<{ success: boolean; id?: number; error?: string }> {
    if (!this.isElectron) {
      return { success: false, error: 'Database not available' };
    }

    const result = await this.database.executeNonQuery(
      `INSERT INTO Autorizaciones (
        SolicitudID, OficinaID, AutorizadorID, FechaAutorizacion,
        HoraInicioAutorizada, HoraFinAutorizada, Observaciones, EstadoID,
        UsuarioCreadorID, FechaCreacion
      ) VALUES (
        @solicitudId, @oficinaId, @autorizadorId, @fecha,
        @inicio, @fin, @observaciones, @estadoId,
        @usuarioCreadorId, CURRENT_TIMESTAMP
      )`,
      {
        solicitudId: record.solicitudId,
        oficinaId: record.oficinaId,
        autorizadorId: record.autorizadorId,
        fecha: record.fecha,
        inicio: record.inicio || null,
        fin: record.fin || null,
        observaciones: record.observaciones,
        estadoId: record.estadoId,
        usuarioCreadorId,
      }
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    await this.loadAll();
    return { success: true, id: Number(result.lastInsertRowid ?? 0) };
  }

  async update(record: AutorizacionRecord, usuarioModificadorId: number): Promise<{ success: boolean; error?: string }> {
    if (!this.isElectron) {
      return { success: false, error: 'Database not available' };
    }

    const result = await this.database.executeNonQuery(
      `UPDATE Autorizaciones SET
        SolicitudID = @solicitudId, OficinaID = @oficinaId, AutorizadorID = @autorizadorId,
        FechaAutorizacion = @fecha, HoraInicioAutorizada = @inicio, HoraFinAutorizada = @fin,
        Observaciones = @observaciones, EstadoID = @estadoId,
        UsuarioModificadorID = @usuarioModificadorId, FechaModificacion = CURRENT_TIMESTAMP
      WHERE AutorizacionID = @id`,
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

    const result = await this.database.executeNonQuery('DELETE FROM Autorizaciones WHERE AutorizacionID = ?', [id]);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    await this.loadAll();
    return { success: true };
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
