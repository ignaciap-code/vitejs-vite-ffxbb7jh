import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// ─── DATOS ────────────────────────────────────────────────────────────────────
const PSICOLOGAS = [
  { id: 1, nombre: 'Francesca Figueroa', color: '#7C6FAF', avatar: 'FF' },
  { id: 2, nombre: 'Trinidad Montes', color: '#4A8FA3', avatar: 'TM' },
  { id: 3, nombre: 'Andrea García', color: '#A06B8A', avatar: 'AG' },
];

const CARRERAS = [
  'Ingeniería Civil',
  'Ingeniería Comercial',
  'Medicina',
  'Derecho',
  'Psicología',
  'Diseño',
  'Arquitectura',
  'Periodismo',
  'Educación',
  'Enfermería',
  'Bioquímica',
  'Trabajo Social',
  'Administración',
  'Contabilidad',
  'Otra',
];

const CORREO_BIENESTAR = 'bienestarysaludmental@uft.cl';
const ADMIN_PASS = 'bienestar2024';

const HORAS_DISPONIBLES = [
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split('-');
  const dias = [
    'domingo',
    'lunes',
    'martes',
    'miércoles',
    'jueves',
    'viernes',
    'sábado',
  ];
  const meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return `${dias[dt.getDay()]} ${d} de ${meses[Number(m) - 1]}`;
}

function horasHasta(fecha: string, hora: string) {
  const ahora = new Date();
  const dt = new Date(`${fecha}T${hora}:00`);
  return (dt.getTime() - ahora.getTime()) / (1000 * 60 * 60);
}

function validarRut(rut: string) {
  const r = rut.replace(/[.\-]/g, '').toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(r)) return false;
  const cuerpo = r.slice(0, -1);
  const dv = r.slice(-1);
  let suma = 0,
    mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const dvEsp = 11 - (suma % 11);
  const dvReal = dvEsp === 11 ? '0' : dvEsp === 10 ? 'K' : String(dvEsp);
  return dv === dvReal;
}

function getFechasProximas(dias = 21) {
  const fechas: string[] = [];
  const hoy = new Date();
  for (let d = 0; d <= dias; d++) {
    const f = new Date(hoy);
    f.setDate(hoy.getDate() + d);
    if (f.getDay() === 0 || f.getDay() === 6) continue;
    fechas.push(f.toISOString().split('T')[0]);
  }
  return fechas;
}

function buildGoogleCalendarUrl({
  titulo,
  fecha,
  hora,
  descripcion,
  duracion = 60,
}: {
  titulo: string;
  fecha: string;
  hora: string;
  descripcion: string;
  duracion?: number;
}) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, min] = hora.split(':').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(min)}00`;
  const end = new Date(y, m - 1, d, h, min + duracion);
  const endStr = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(
    end.getDate()
  )}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    titulo
  )}&dates=${start}/${endStr}&details=${encodeURIComponent(descripcion)}`;
}

// ─── TIPOS ────────────────────────────────────────────────────────────────────
interface Slot {
  id: string;
  psicologa_id: number;
  fecha: string;
  hora: string;
  disponible: boolean;
  nombre_estudiante: string | null;
  rut_estudiante: string | null;
  carrera: string | null;
  correo_estudiante: string | null;
  realizada: boolean;
}

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
async function cargarSlots(): Promise<Slot[]> {
  const { data } = await supabase
    .from('slots')
    .select('*')
    .order('fecha')
    .order('hora');
  return (data as Slot[]) || [];
}

// ─── VISTA ESTUDIANTE ─────────────────────────────────────────────────────────
function VistaEstudiante({
  slots,
  recargar,
}: {
  slots: Slot[];
  recargar: () => void;
}) {
  const [psicologaFiltro, setPsicologaFiltro] = useState<number | null>(null);
  const [slotSel, setSlotSel] = useState<Slot | null>(null);
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [carrera, setCarrera] = useState('');
  const [correo, setCorreo] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [exito, setExito] = useState<Slot | null>(null);
  const [cargando, setCargando] = useState(false);

  const disponibles = slots.filter((s) => s.disponible && !s.realizada);
  const filtrados = psicologaFiltro
    ? disponibles.filter((s) => s.psicologa_id === psicologaFiltro)
    : disponibles;

  async function handleReservar() {
    const e: Record<string, string> = {};
    if (!nombre.trim()) e.nombre = 'Requerido';
    if (!validarRut(rut)) e.rut = 'RUT inválido';
    if (!carrera) e.carrera = 'Requerido';
    if (!correo.includes('@')) e.correo = 'Correo inválido';
    if (Object.keys(e).length) {
      setErrores(e);
      return;
    }
    if (!slotSel) return;
    setCargando(true);
    const { error } = await supabase
      .from('slots')
      .update({
        disponible: false,
        nombre_estudiante: nombre.trim(),
        rut_estudiante: rut.trim(),
        carrera,
        correo_estudiante: correo.trim(),
      })
      .eq('id', slotSel.id);
    if (!error) {
      setExito(slotSel);
      setSlotSel(null);
      setNombre('');
      setRut('');
      setCarrera('');
      setCorreo('');
      setErrores({});
      recargar();
    }
    setCargando(false);
  }

  if (exito)
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: '#1a1040',
            marginBottom: 8,
          }}
        >
          ¡Hora agendada!
        </h2>
        <p style={{ color: '#7b6fa0', marginBottom: 8 }}>
          {PSICOLOGAS.find((p) => p.id === exito.psicologa_id)?.nombre}
        </p>
        <p style={{ fontWeight: 700, color: '#3d2f7a', marginBottom: 16 }}>
          {formatFecha(exito.fecha)} a las {exito.hora}
        </p>
        <a
          href={buildGoogleCalendarUrl({
            titulo: `Sesión Bienestar Estudiantil — ${
              PSICOLOGAS.find((p) => p.id === exito.psicologa_id)?.nombre
            }`,
            fecha: exito.fecha,
            hora: exito.hora,
            descripcion: `Sesión de atención psicológica en Bienestar Estudiantil UFT.\nPsicóloga: ${
              PSICOLOGAS.find((p) => p.id === exito.psicologa_id)?.nombre
            }\nContacto: ${CORREO_BIENESTAR}`,
          })}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '11px',
            background: '#f0fdf4',
            border: '1.5px solid #86efac',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 13,
            color: '#166534',
            textDecoration: 'none',
            boxSizing: 'border-box',
            marginBottom: 10,
          }}
        >
          📅 Agregar a Google Calendar
        </a>
        <button
          onClick={() => setExito(null)}
          style={{
            padding: '12px 28px',
            background: '#3d2f7a',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Agendar otra hora
        </button>
      </div>
    );

  return (
    <div>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 900,
          color: '#1a1040',
          marginBottom: 4,
        }}
      >
        Agendar hora
      </h2>
      <p style={{ color: '#7b6fa0', marginBottom: 20, fontSize: 14 }}>
        Selecciona una psicóloga y un horario disponible
      </p>
      <div
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}
      >
        <button
          onClick={() => setPsicologaFiltro(null)}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1.5px solid',
            borderColor: psicologaFiltro === null ? '#3d2f7a' : '#dcd7f0',
            background: psicologaFiltro === null ? '#3d2f7a' : 'white',
            color: psicologaFiltro === null ? 'white' : '#7b6fa0',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Cualquier psicóloga
        </button>
        {PSICOLOGAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPsicologaFiltro(p.id)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1.5px solid',
              borderColor: psicologaFiltro === p.id ? p.color : '#dcd7f0',
              background: psicologaFiltro === p.id ? p.color : 'white',
              color: psicologaFiltro === p.id ? 'white' : '#7b6fa0',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {p.nombre}
          </button>
        ))}
      </div>
      {filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#a89ec0' }}>
          No hay horarios disponibles
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map((s) => {
            const p = PSICOLOGAS.find((x) => x.id === s.psicologa_id)!;
            const sel = slotSel?.id === s.id;
            return (
              <div
                key={s.id}
                style={{
                  background: 'white',
                  borderRadius: 14,
                  padding: 16,
                  border: `1.5px solid ${sel ? p.color : '#ede9f8'}`,
                  boxShadow: sel ? `0 0 0 3px ${p.color}22` : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setSlotSel(sel ? null : s)}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: p.color,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 12,
                      }}
                    >
                      {p.avatar}
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: '#1a1040',
                        }}
                      >
                        {p.nombre}
                      </div>
                      <div style={{ fontSize: 12, color: '#7b6fa0' }}>
                        {formatFecha(s.fecha)} · {s.hora}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: '#f0fdf4',
                      color: '#166534',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Disponible
                  </div>
                </div>
                {sel && (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop: '1px solid #ede9f8',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 10,
                      }}
                    >
                      {[
                        {
                          label: 'Nombre completo',
                          val: nombre,
                          set: setNombre,
                          key: 'nombre',
                          type: 'text',
                          full: true,
                        },
                        {
                          label: 'RUT (ej: 12.345.678-9)',
                          val: rut,
                          set: setRut,
                          key: 'rut',
                          type: 'text',
                          full: false,
                        },
                        {
                          label: 'Correo institucional',
                          val: correo,
                          set: setCorreo,
                          key: 'correo',
                          type: 'email',
                          full: false,
                        },
                      ].map((f) => (
                        <div
                          key={f.key}
                          style={{ gridColumn: f.full ? '1 / -1' : 'auto' }}
                        >
                          <label
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#7b6fa0',
                              display: 'block',
                              marginBottom: 4,
                            }}
                          >
                            {f.label}
                          </label>
                          <input
                            type={f.type}
                            value={f.val}
                            onChange={(e) => {
                              f.set(e.target.value);
                              setErrores((prev) => ({ ...prev, [f.key]: '' }));
                            }}
                            style={{
                              width: '100%',
                              padding: '9px 12px',
                              borderRadius: 8,
                              boxSizing: 'border-box',
                              border: `1.5px solid ${
                                errores[f.key] ? '#e05a5a' : '#dcd7f0'
                              }`,
                              fontSize: 13,
                              fontFamily: 'inherit',
                              outline: 'none',
                            }}
                          />
                          {errores[f.key] && (
                            <div
                              style={{
                                fontSize: 11,
                                color: '#e05a5a',
                                marginTop: 2,
                              }}
                            >
                              {errores[f.key]}
                            </div>
                          )}
                        </div>
                      ))}
                      <div>
                        <label
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#7b6fa0',
                            display: 'block',
                            marginBottom: 4,
                          }}
                        >
                          Carrera
                        </label>
                        <select
                          value={carrera}
                          onChange={(e) => {
                            setCarrera(e.target.value);
                            setErrores((prev) => ({ ...prev, carrera: '' }));
                          }}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: 8,
                            boxSizing: 'border-box',
                            border: `1.5px solid ${
                              errores.carrera ? '#e05a5a' : '#dcd7f0'
                            }`,
                            fontSize: 13,
                            fontFamily: 'inherit',
                            outline: 'none',
                            background: 'white',
                          }}
                        >
                          <option value="">Selecciona...</option>
                          {CARRERAS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        {errores.carrera && (
                          <div
                            style={{
                              fontSize: 11,
                              color: '#e05a5a',
                              marginTop: 2,
                            }}
                          >
                            {errores.carrera}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleReservar}
                      disabled={cargando}
                      style={{
                        width: '100%',
                        marginTop: 14,
                        padding: 12,
                        background: cargando ? '#a89ec0' : '#3d2f7a',
                        color: 'white',
                        border: 'none',
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: cargando ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {cargando ? 'Agendando...' : 'Confirmar reserva'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── VISTA CANCELAR ───────────────────────────────────────────────────────────
function VistaCancelar({
  slots,
  recargar,
}: {
  slots: Slot[];
  recargar: () => void;
}) {
  const [rut, setRut] = useState('');
  const [rutBuscado, setRutBuscado] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const misReservas = rutBuscado
    ? slots.filter(
        (s) =>
          !s.disponible &&
          !s.realizada &&
          s.rut_estudiante?.replace(/[.\-]/g, '') ===
            rutBuscado.replace(/[.\-]/g, '')
      )
    : [];

  function buscar() {
    if (!validarRut(rut)) {
      setError('RUT inválido');
      return;
    }
    setError('');
    setRutBuscado(rut);
  }

  async function handleCancelar(s: Slot) {
    setCargando(true);
    await supabase
      .from('slots')
      .update({
        disponible: true,
        nombre_estudiante: null,
        rut_estudiante: null,
        carrera: null,
        correo_estudiante: null,
      })
      .eq('id', s.id);
    recargar();
    setCargando(false);
  }

  function buildCorreo(s: Slot) {
    const p = PSICOLOGAS.find((x) => x.id === s.psicologa_id);
    const subject = encodeURIComponent(
      `Solicitud de cancelación — ${s.nombre_estudiante}`
    );
    const body = encodeURIComponent(
      `Estimado equipo de Bienestar y Salud Mental,\n\n` +
        `Solicito cancelar mi sesión con menos de 24 horas de anticipación.\n\n` +
        `Mis datos:\n• Nombre: ${s.nombre_estudiante}\n• RUT: ${s.rut_estudiante}\n` +
        `• Correo: ${s.correo_estudiante}\n• Psicóloga: ${p?.nombre}\n` +
        `• Fecha y hora: ${formatFecha(s.fecha)} a las ${s.hora}\n\nSaludos`
    );
    return `mailto:${CORREO_BIENESTAR}?subject=${subject}&body=${body}`;
  }

  return (
    <div>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 900,
          color: '#1a1040',
          marginBottom: 4,
        }}
      >
        Cancelar hora
      </h2>
      <p style={{ color: '#7b6fa0', marginBottom: 20, fontSize: 14 }}>
        Ingresa tu RUT para ver tus reservas activas
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={rut}
          onChange={(e) => {
            setRut(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          placeholder="12.345.678-9"
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 10,
            boxSizing: 'border-box',
            border: `1.5px solid ${error ? '#e05a5a' : '#dcd7f0'}`,
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          onClick={buscar}
          style={{
            padding: '10px 20px',
            background: '#3d2f7a',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Buscar
        </button>
      </div>
      {error && (
        <div style={{ fontSize: 12, color: '#e05a5a', marginBottom: 12 }}>
          {error}
        </div>
      )}
      {rutBuscado && misReservas.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#a89ec0' }}>
          No tienes horas reservadas
        </div>
      )}
      {misReservas.map((s) => {
        const p = PSICOLOGAS.find((x) => x.id === s.psicologa_id)!;
        const urgente = horasHasta(s.fecha, s.hora) < 24;
        return (
          <div
            key={s.id}
            style={{
              background: 'white',
              borderRadius: 14,
              padding: 16,
              border: '1.5px solid #ede9f8',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: p.color,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {p.avatar}
              </div>
              <div>
                <div
                  style={{ fontWeight: 700, fontSize: 14, color: '#1a1040' }}
                >
                  {p.nombre}
                </div>
                <div style={{ fontSize: 12, color: '#7b6fa0' }}>
                  {formatFecha(s.fecha)} · {s.hora}
                </div>
              </div>
            </div>
            {urgente && (
              <div
                style={{
                  background: '#fef3c7',
                  border: '1.5px solid #fcd34d',
                  borderRadius: 10,
                  padding: '10px 14px',
                  marginBottom: 10,
                  fontSize: 13,
                }}
              >
                ⚠️ Faltan menos de 24 horas. Debes contactar a bienestar por
                correo.
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#92400e',
                    marginTop: 4,
                  }}
                >
                  📧 {CORREO_BIENESTAR}
                </div>
              </div>
            )}
            {urgente ? (
              <a
                href={buildCorreo(s)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '11px',
                  background: '#fef3c7',
                  border: '1.5px solid #fcd34d',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#92400e',
                  textDecoration: 'none',
                  boxSizing: 'border-box',
                }}
              >
                ✉️ Enviar correo de cancelación
              </a>
            ) : (
              <button
                onClick={() => handleCancelar(s)}
                disabled={cargando}
                style={{
                  width: '100%',
                  padding: '11px',
                  background: '#fff1f1',
                  border: '1.5px solid #fca5a5',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#b91c1c',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancelar esta hora
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── PANEL ADMIN ──────────────────────────────────────────────────────────────
function PanelAdmin({
  slots,
  recargar,
}: {
  slots: Slot[];
  recargar: () => void;
}) {
  const [tab, setTab] = useState<'horarios' | 'reservas'>('reservas');
  const [psicologaFiltro, setPsicologaFiltro] = useState<number>(1);
  const [cargando, setCargando] = useState(false);

  // Para agregar horario
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHora, setNuevaHora] = useState('');
  const [nuevaPsi, setNuevaPsi] = useState<number>(1);
  const [msgExito, setMsgExito] = useState('');

  const reservasActivas = slots.filter(
    (s) => s.psicologa_id === psicologaFiltro && !s.disponible && !s.realizada
  );
  const horariosDisponibles = slots.filter(
    (s) => s.psicologa_id === psicologaFiltro && s.disponible
  );

  async function agregarHorario() {
    if (!nuevaFecha || !nuevaHora) return;
    // Verificar que no exista ya
    const existe = slots.find(
      (s) =>
        s.psicologa_id === nuevaPsi &&
        s.fecha === nuevaFecha &&
        s.hora === nuevaHora
    );
    if (existe) {
      setMsgExito('⚠️ Ese horario ya existe');
      setTimeout(() => setMsgExito(''), 3000);
      return;
    }
    setCargando(true);
    await supabase.from('slots').insert({
      psicologa_id: nuevaPsi,
      fecha: nuevaFecha,
      hora: nuevaHora,
      disponible: true,
      realizada: false,
      nombre_estudiante: null,
      rut_estudiante: null,
      carrera: null,
      correo_estudiante: null,
    });
    setMsgExito('✅ Horario agregado');
    setTimeout(() => setMsgExito(''), 3000);
    setNuevaFecha('');
    setNuevaHora('');
    recargar();
    setCargando(false);
  }

  async function eliminarHorario(id: string) {
    setCargando(true);
    await supabase.from('slots').delete().eq('id', id);
    recargar();
    setCargando(false);
  }

  async function marcarRealizada(id: string) {
    setCargando(true);
    await supabase.from('slots').update({ realizada: true }).eq('id', id);
    recargar();
    setCargando(false);
  }

  async function cancelarAdmin(id: string) {
    setCargando(true);
    await supabase
      .from('slots')
      .update({
        disponible: true,
        nombre_estudiante: null,
        rut_estudiante: null,
        carrera: null,
        correo_estudiante: null,
      })
      .eq('id', id);
    recargar();
    setCargando(false);
  }

  const fechasProximas = getFechasProximas(60);

  return (
    <div>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 900,
          color: '#1a1040',
          marginBottom: 4,
        }}
      >
        Panel de psicólogas
      </h2>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 20,
          borderBottom: '2px solid #ede9f8',
          paddingBottom: 0,
        }}
      >
        {(
          [
            ['reservas', '📋 Reservas activas'],
            ['horarios', '🗓 Gestionar horarios'],
          ] as [typeof tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: tab === t ? '#3d2f7a' : '#a89ec0',
              borderBottom:
                tab === t ? '2px solid #3d2f7a' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Selector psicóloga */}
      <div
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}
      >
        {PSICOLOGAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPsicologaFiltro(p.id)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1.5px solid',
              borderColor: psicologaFiltro === p.id ? p.color : '#dcd7f0',
              background: psicologaFiltro === p.id ? p.color : 'white',
              color: psicologaFiltro === p.id ? 'white' : '#7b6fa0',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      {/* TAB: RESERVAS */}
      {tab === 'reservas' && (
        <>
          {reservasActivas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#a89ec0' }}>
              No hay reservas activas
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reservasActivas.map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: 'white',
                    borderRadius: 14,
                    padding: 16,
                    border: '1.5px solid #ede9f8',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 15,
                      color: '#1a1040',
                      marginBottom: 4,
                    }}
                  >
                    {s.nombre_estudiante}
                  </div>
                  <div
                    style={{ fontSize: 13, color: '#7b6fa0', marginBottom: 2 }}
                  >
                    {formatFecha(s.fecha)} · {s.hora}
                  </div>
                  <div
                    style={{ fontSize: 13, color: '#7b6fa0', marginBottom: 2 }}
                  >
                    RUT: {s.rut_estudiante} · Carrera: {s.carrera}
                  </div>
                  <div
                    style={{ fontSize: 13, color: '#7b6fa0', marginBottom: 12 }}
                  >
                    📧 {s.correo_estudiante}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <a
                      href={buildGoogleCalendarUrl({
                        titulo: `Sesión con ${s.nombre_estudiante}`,
                        fecha: s.fecha,
                        hora: s.hora,
                        descripcion: `Estudiante: ${s.nombre_estudiante}\nRUT: ${s.rut_estudiante}\nCarrera: ${s.carrera}\nCorreo: ${s.correo_estudiante}`,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '9px',
                        background: '#f0fdf4',
                        border: '1.5px solid #86efac',
                        borderRadius: 9,
                        fontWeight: 700,
                        fontSize: 12,
                        color: '#166534',
                        textDecoration: 'none',
                        boxSizing: 'border-box',
                      }}
                    >
                      📅 Google Calendar
                    </a>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => marcarRealizada(s.id)}
                      disabled={cargando}
                      style={{
                        flex: 1,
                        padding: '9px',
                        background: '#f0fdf4',
                        border: '1.5px solid #86efac',
                        borderRadius: 9,
                        fontWeight: 700,
                        fontSize: 12,
                        color: '#166534',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      ✓ Marcar como realizada
                    </button>
                    <button
                      onClick={() => cancelarAdmin(s.id)}
                      disabled={cargando}
                      style={{
                        flex: 1,
                        padding: '9px',
                        background: '#fff1f1',
                        border: '1.5px solid #fca5a5',
                        borderRadius: 9,
                        fontWeight: 700,
                        fontSize: 12,
                        color: '#b91c1c',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      🗑 Cancelar reserva
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB: HORARIOS */}
      {tab === 'horarios' && (
        <>
          {/* Agregar horario */}
          <div
            style={{
              background: 'white',
              borderRadius: 14,
              padding: 16,
              border: '1.5px solid #ede9f8',
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: '#1a1040',
                marginBottom: 12,
              }}
            >
              ➕ Agregar nuevo horario
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 10,
                marginBottom: 12,
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#7b6fa0',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Psicóloga
                </label>
                <select
                  value={nuevaPsi}
                  onChange={(e) => setNuevaPsi(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    boxSizing: 'border-box',
                    border: '1.5px solid #dcd7f0',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                    background: 'white',
                  }}
                >
                  {PSICOLOGAS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#7b6fa0',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Fecha
                </label>
                <select
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    boxSizing: 'border-box',
                    border: '1.5px solid #dcd7f0',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                    background: 'white',
                  }}
                >
                  <option value="">Selecciona...</option>
                  {fechasProximas.map((f) => (
                    <option key={f} value={f}>
                      {formatFecha(f)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#7b6fa0',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Hora
                </label>
                <select
                  value={nuevaHora}
                  onChange={(e) => setNuevaHora(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    boxSizing: 'border-box',
                    border: '1.5px solid #dcd7f0',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                    background: 'white',
                  }}
                >
                  <option value="">Selecciona...</option>
                  {HORAS_DISPONIBLES.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={agregarHorario}
              disabled={cargando || !nuevaFecha || !nuevaHora}
              style={{
                width: '100%',
                padding: 11,
                background: !nuevaFecha || !nuevaHora ? '#dcd7f0' : '#3d2f7a',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: !nuevaFecha || !nuevaHora ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Agregar horario
            </button>
            {msgExito && (
              <div
                style={{
                  fontSize: 13,
                  textAlign: 'center',
                  marginTop: 8,
                  color: '#166534',
                }}
              >
                {msgExito}
              </div>
            )}
          </div>

          {/* Lista horarios disponibles */}
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: '#1a1040',
              marginBottom: 12,
            }}
          >
            Horarios disponibles de{' '}
            {PSICOLOGAS.find((p) => p.id === psicologaFiltro)?.nombre}
          </div>
          {horariosDisponibles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#a89ec0' }}>
              No hay horarios disponibles — agrega uno arriba
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {horariosDisponibles.map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: 'white',
                    borderRadius: 12,
                    padding: '12px 16px',
                    border: '1.5px solid #ede9f8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{ fontSize: 14, color: '#1a1040', fontWeight: 600 }}
                  >
                    {formatFecha(s.fecha)} · {s.hora}
                  </div>
                  <button
                    onClick={() => eliminarHorario(s.id)}
                    disabled={cargando}
                    style={{
                      padding: '6px 12px',
                      background: '#fff1f1',
                      border: '1.5px solid #fca5a5',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 12,
                      color: '#b91c1c',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    🗑 Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function App() {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [vista, setVista] = useState<'estudiante' | 'cancelar' | 'admin'>(
    'estudiante'
  );
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState(false);

  async function recargar() {
    const data = await cargarSlots();
    setSlots(data);
  }

  useEffect(() => {
    recargar();
  }, []);

  useEffect(() => {
    if (vista !== 'admin' || !adminAuth) return;
    const id = setInterval(recargar, 10000);
    return () => clearInterval(id);
  }, [vista, adminAuth]);

  function handleAdminLogin() {
    if (adminPass === ADMIN_PASS) {
      setAdminAuth(true);
      setAdminError(false);
    } else setAdminError(true);
  }

  if (slots === null)
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg,#f0edfc,#e8f4fb)',
        }}
      >
        <div style={{ textAlign: 'center', color: '#7b6fa0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌿</div>
          <div style={{ fontWeight: 700 }}>Cargando…</div>
        </div>
      </div>
    );

  const NAV: [typeof vista, string][] = [
    ['estudiante', 'Agendar'],
    ['cancelar', 'Cancelar hora'],
    ['admin', 'Panel'],
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(160deg,#f0edfc 0%,#e8f4fb 60%,#f9f0f5 100%)',
        fontFamily: "'Segoe UI',system-ui,sans-serif",
      }}
    >
      <div
        style={{
          background: 'white',
          borderBottom: '1.5px solid #e8e4f0',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 62,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'linear-gradient(135deg,#3d2f7a,#7C6FAF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
              }}
            >
              🌿
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#1a1040' }}>
                Bienestar Estudiantil
              </div>
              <div style={{ fontSize: 11, color: '#a89ec0' }}>
                Agenda tu hora de atención
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {NAV.map(([val, label]) => (
              <button
                key={val}
                onClick={() => {
                  setVista(val);
                  if (val !== 'admin') {
                    setAdminAuth(false);
                    setAdminPass('');
                    setAdminError(false);
                  }
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: 8,
                  background: vista === val ? '#3d2f7a' : 'transparent',
                  color: vista === val ? 'white' : '#7b6fa0',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 80px' }}
      >
        {vista === 'estudiante' && (
          <VistaEstudiante slots={slots} recargar={recargar} />
        )}
        {vista === 'cancelar' && (
          <VistaCancelar slots={slots} recargar={recargar} />
        )}
        {vista === 'admin' && !adminAuth && (
          <div
            style={{ maxWidth: 360, margin: '60px auto', textAlign: 'center' }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: '#1a1040',
                marginBottom: 6,
              }}
            >
              Panel de psicólogas
            </h2>
            <p style={{ color: '#7b6fa0', marginBottom: 24, fontSize: 14 }}>
              Ingresa la contraseña para acceder.
            </p>
            <input
              type="password"
              value={adminPass}
              onChange={(e) => {
                setAdminPass(e.target.value);
                setAdminError(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
              placeholder="Contraseña"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 10,
                boxSizing: 'border-box',
                border: `1.5px solid ${adminError ? '#e05a5a' : '#dcd7f0'}`,
                fontSize: 14,
                marginBottom: 8,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            {adminError && (
              <div style={{ fontSize: 12, color: '#e05a5a', marginBottom: 8 }}>
                Contraseña incorrecta
              </div>
            )}
            <button
              onClick={handleAdminLogin}
              style={{
                width: '100%',
                padding: 12,
                background: '#3d2f7a',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Ingresar
            </button>
          </div>
        )}
        {vista === 'admin' && adminAuth && (
          <PanelAdmin slots={slots} recargar={recargar} />
        )}
      </div>
    </div>
  );
}
