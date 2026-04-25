import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('Solicitudes');
    expect(compiled.textContent).toContain('Nueva solicitud');
    expect(compiled.textContent).toContain('Guardar');
  });

  it('should validate time range', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const app = fixture.componentInstance as App & { form: any };
    app.form.patchValue({
      sectorId: 1,
      oficinaId: 1,
      solicitanteId: 1,
      fecha: '2026-04-25',
      inicio: '10:00',
      fin: '09:00',
      motivo: 'Validación de horarios',
      estadoId: 1,
    });

    expect(app.form.valid).toBeFalsy();
    expect(app.form.errors?.['invalidTimeRange']).toBeTruthy();
  });
});
