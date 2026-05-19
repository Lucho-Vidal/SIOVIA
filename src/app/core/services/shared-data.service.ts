import { Injectable, signal } from '@angular/core';
import { DatabaseService } from '../database/database.service';

export interface LookupItem {
  id: number;
  nombre: string;
}

@Injectable({
  providedIn: 'root'
})
export class SharedDataService {
  private readonly isElectron = typeof window !== 'undefined' && !!window.electronAPI?.executeQuery;

  readonly sectores = signal<LookupItem[]>([]);
  readonly oficinas = signal<LookupItem[]>([]);
  readonly personal = signal<LookupItem[]>([]);
  readonly estados = signal<LookupItem[]>([]);
  readonly estadosAutorizacion = signal<LookupItem[]>([]);

  private readonly QUERY_SECTORES = `SELECT SectorID AS id, Nombre AS nombre FROM Sectores WHERE Activo = 1 ORDER BY Nombre;`;
  private readonly QUERY_OFICINAS = `SELECT OficinaID AS id, Nombre AS nombre FROM Oficinas WHERE Activo = 1 ORDER BY Nombre;`;
  private readonly QUERY_PERSONAL = `SELECT PersonalID AS id, Nombre || ' ' || Apellido AS nombre FROM Personal WHERE Activo = 1 ORDER BY Nombre, Apellido;`;
  private readonly QUERY_ESTADOS = `SELECT EstadoID AS id, Descripcion AS nombre FROM EstadosSolicitud ORDER BY EstadoID;`;
  private readonly QUERY_ESTADOS_AUTORIZACION = `SELECT EstadoID AS id, Descripcion AS nombre FROM EstadosAutorizacion ORDER BY EstadoID;`;

  constructor(private readonly database: DatabaseService) {}

  async loadAll(): Promise<boolean> {
    if (!this.isElectron) {
      return false;
    }

    const [sectores, oficinas, personal, estados, estadosAutorizacion] = await Promise.all([
      this.database.executeQuery(this.QUERY_SECTORES),
      this.database.executeQuery(this.QUERY_OFICINAS),
      this.database.executeQuery(this.QUERY_PERSONAL),
      this.database.executeQuery(this.QUERY_ESTADOS),
      this.database.executeQuery(this.QUERY_ESTADOS_AUTORIZACION),
    ]);

    const allSuccess = [sectores, oficinas, personal, estados, estadosAutorizacion].every(
      (result) => result.success && Array.isArray(result.data)
    );

    if (!allSuccess) {
      return false;
    }

    this.sectores.set(this.mapLookup(sectores.data ?? []));
    this.oficinas.set(this.mapLookup(oficinas.data ?? []));
    this.personal.set(this.mapLookup(personal.data ?? []));
    this.estados.set(this.mapLookup(estados.data ?? []));
    this.estadosAutorizacion.set(this.mapLookup(estadosAutorizacion.data ?? []));

    return true;
  }

  private mapLookup(rows: any[]): LookupItem[] {
    return rows.map((row) => ({
      id: Number(row.id),
      nombre: String(row.nombre ?? ''),
    }));
  }
}
