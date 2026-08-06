import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const PSICOLOGAS = [
  { id: 1, nombre: 'Francesca Figueroa', color: '#7C6FAF', avatar: 'FF' },
  { id: 2, nombre: 'Trinidad Montes', color: '#4A8FA3', avatar: 'TM' },
  { id: 3, nombre: 'Andrea García', color: '#A06B8A', avatar: 'AG' },
];

const CARRERAS = [
  'Ingeniería Civil','Ingeniería Comercial','Medicina','Derecho','Psicología',
  'Diseño','Arquitectura','Periodismo','Educación','Enfermería',
  'Bioquímica','Trabajo Social','Administración','Contabilidad','Otra',
];

const CORREO_BIENESTAR = 'bienestarysaludmental@uft.cl';
const ADMIN_PASS = 'bienestar2024';
const BITACORA_PASS = 'bitacora2024';

// ─── HORARIO FIJO SEMANAL ──────────────────────────────────────────────────
// dia: 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes
// Se autogeneran siempre 4 semanas hacia adelante (ver asegurarHorariosFijos).
// Estos bloques quedan marcados como reserva_tipo:'fijo' y no se pueden
// eliminar desde el panel (para evitar que se borren por error).
const SEMANAS_VENTANA_FIJA = 4;

const PLANTILLA_FIJA: Record<number, { dia: number; hora: string }[]> = {
  1: [ // Francesca Figueroa
    { dia: 1, hora: '11:00' }, { dia: 1, hora: '12:00' },
    { dia: 3, hora: '12:00' }, { dia: 3, hora: '13:00' },
    { dia: 4, hora: '11:00' }, { dia: 4, hora: '12:00' },
  ],
  2: [ // Trinidad Montes
    { dia: 1, hora: '12:00' }, { dia: 1, hora: '15:00' },
    { dia: 3, hora: '11:00' },
    { dia: 4, hora: '09:00' }, { dia: 4, hora: '10:00' },
    { dia: 5, hora: '10:00' },
  ],
  3: [ // Andrea García
    { dia: 1, hora: '15:00' },
    { dia: 2, hora: '10:00' }, { dia: 2, hora: '13:00' },
    { dia: 4, hora: '10:00' }, { dia: 4, hora: '12:00' },
    { dia: 5, hora: '10:00' }, { dia: 5, hora: '12:00' },
  ],
};

function generarVentanaFija(semanas = SEMANAS_VENTANA_FIJA) {
  const dias: { fecha: string; dow: number }[] = [];
  const hoy = new Date();
  const totalDias = semanas * 7;
  for (let i = 0; i <= totalDias; i++) {
    const f = new Date(hoy);
    f.setDate(hoy.getDate() + i);
    const dow = f.getDay();
    if (dow === 0 || dow === 6) continue;
    dias.push({ fecha: fmtLocal(f), dow });
  }
  return dias;
}

interface DiaBloqueado {
  id: string;
  psicologa_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
}

async function cargarDiasBloqueados(): Promise<DiaBloqueado[]> {
  const { data } = await supabase.from('dias_bloqueados').select('*').order('fecha_inicio');
  return (data as DiaBloqueado[]) || [];
}

function fechaBloqueada(psiId: number, fecha: string, bloqueos: DiaBloqueado[]) {
  return bloqueos.some(b => b.psicologa_id === psiId && fecha >= b.fecha_inicio && fecha <= b.fecha_fin);
}

// Revisa la ventana de próximas semanas y crea los horarios fijos que falten,
// saltándose las fechas que estén dentro de un rango bloqueado (vacaciones, etc.)
async function asegurarHorariosFijos(slotsActuales: Slot[], bloqueos: DiaBloqueado[] = []) {
  const ventana = generarVentanaFija();
  const existentes = new Set(slotsActuales.map(s => `${s.psicologa_id}|${s.fecha}|${s.hora}`));
  const nuevos: any[] = [];

  for (const psiIdStr of Object.keys(PLANTILLA_FIJA)) {
    const psiId = Number(psiIdStr);
      for (const bloque of PLANTILLA_FIJA[psiId]) {
        for (const { fecha, dow } of ventana) {
          if (dow !== bloque.dia) continue;
          if (fechaBloqueada(psiId, fecha, bloqueos)) continue;
          const key = `${psiId}|${fecha}|${bloque.hora}`;
        if (existentes.has(key)) continue;
        existentes.add(key);
        nuevos.push({
          psicologa_id: psiId, fecha, hora: bloque.hora,
          disponible: true, realizada: false, reserva_tipo: 'fijo',
          nombre_estudiante: null, rut_estudiante: null, carrera: null, correo_estudiante: null,
        });
      }
    }
  }

  if (nuevos.length > 0) {
    await supabase.from('slots').insert(nuevos);
  }
  return nuevos.length;
}

const HORAS_DISPONIBLES = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','14:00','14:30','15:00','15:30','16:00','16:30','17:00',
];

function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split('-');
  const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
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
  let suma = 0, mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const dvEsp = 11 - (suma % 11);
  const dvReal = dvEsp === 11 ? '0' : dvEsp === 10 ? 'K' : String(dvEsp);
  return dv === dvReal;
}

// Formatea una fecha usando el día/mes/año LOCAL (evita el desfase que produce
// toISOString(), que convierte a UTC y puede correr la fecha al día siguiente).
function fmtLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getFechasProximas(dias = 21) {
  const fechas: string[] = [];
  const hoy = new Date();
  for (let d = 0; d <= dias; d++) {
    const f = new Date(hoy);
    f.setDate(hoy.getDate() + d);
    if (f.getDay() === 0 || f.getDay() === 6) continue;
    fechas.push(fmtLocal(f));
  }
  return fechas;
}

function buildGoogleCalendarUrl({ titulo, fecha, hora, descripcion, duracion = 60 }: {
  titulo: string; fecha: string; hora: string; descripcion: string; duracion?: number;
}) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, min] = hora.split(':').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(min)}00`;
  const end = new Date(y, m - 1, d, h, min + duracion);
  const endStr = `${end.getFullYear()}${pad(end.getMonth()+1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${start}/${endStr}&details=${encodeURIComponent(descripcion)}`;
}

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
  reserva_tipo: string | null;
}

async function cargarSlots(): Promise<Slot[]> {
  const { data } = await supabase.from('slots').select('*').order('fecha').order('hora');
  return (data as Slot[]) || [];
}

// ─── POLÍTICA DE PRIVACIDAD ───────────────────────────────────────────────────
function PoliticaPrivacidad({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 16,
    }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: 28,
        width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 900, color: '#1a1040', margin: 0 }}>Política de Privacidad</h2>
          <button onClick={onClose} style={{
            background: '#f5f3ff', border: 'none', borderRadius: 8,
            width: 32, height: 32, fontSize: 18, cursor: 'pointer', color: '#7b6fa0',
          }}>×</button>
        </div>

        <div style={{ fontSize: 13, color: '#4a4560', lineHeight: 1.7 }}>
          <p style={{ color: '#7b6fa0', fontSize: 12, marginBottom: 16 }}>
            Unidad de Bienestar y Salud Mental — Dirección de Asuntos Estudiantiles — Universidad Finis Terrae<br/>
            Última actualización: junio 2026
          </p>

          <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1a1040', marginBottom: 6 }}>1. Responsable del tratamiento</h3>
          <p>La <strong>Unidad de Bienestar y Salud Mental</strong>, dependiente de la Dirección de Asuntos Estudiantiales de la Universidad Finis Terrae, es responsable del tratamiento de los datos personales recopilados a través de esta plataforma. Contacto: <a href="mailto:bienestarysaludmental@uft.cl" style={{ color: '#3d2f7a' }}>bienestarysaludmental@uft.cl</a></p>

          <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1a1040', marginBottom: 6, marginTop: 16 }}>2. Datos que recopilamos</h3>
          <p>Al agendar una hora, recopilamos exclusivamente: nombre completo, RUT, carrera y correo electrónico institucional. <strong>No recopilamos</strong> información sobre el motivo de consulta, diagnósticos ni ningún dato de salud mental.</p>

          <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1a1040', marginBottom: 6, marginTop: 16 }}>3. Finalidad del tratamiento</h3>
          <p>Sus datos se utilizan exclusivamente para: gestionar y confirmar la reserva de hora de atención, y enviar recordatorios de la sesión agendada.</p>

          <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1a1040', marginBottom: 6, marginTop: 16 }}>4. Base de legitimación</h3>
          <p>El tratamiento se basa en el <strong>consentimiento expreso, libre, específico e informado</strong> que usted otorga al momento de agendar su hora, conforme a la Ley N° 21.719 sobre Protección de Datos Personales de Chile.</p>

          <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1a1040', marginBottom: 6, marginTop: 16 }}>5. Almacenamiento y seguridad</h3>
          <p>Sus datos se almacenan en servidores seguros provistos por <strong>Supabase</strong> (infraestructura en la nube bajo estándares de seguridad internacionales). El acceso está restringido exclusivamente al equipo de la Unidad de Bienestar y Salud Mental.</p>

          <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1a1040', marginBottom: 6, marginTop: 16 }}>6. Conservación de datos</h3>
          <p>Sus datos serán conservados durante el período académico activo y eliminados o anonimizados una vez que dejen de ser necesarios para los fines descritos.</p>

          <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1a1040', marginBottom: 6, marginTop: 16 }}>7. Sus derechos</h3>
          <p>Conforme a la Ley N° 21.719, usted tiene derecho a <strong>acceder, rectificar, cancelar y oponerse</strong> al tratamiento de sus datos (derechos ARCO), así como a revocar su consentimiento en cualquier momento. Para ejercer estos derechos, contáctenos en: <a href="mailto:bienestarysaludmental@uft.cl" style={{ color: '#3d2f7a' }}>bienestarysaludmental@uft.cl</a></p>
        </div>

        <button onClick={onClose} style={{
          width: '100%', marginTop: 20, padding: 11, background: '#3d2f7a',
          color: 'white', border: 'none', borderRadius: 10,
          fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
        }}>Cerrar</button>
      </div>
    </div>
  );
}

// ─── BANNER DE CRISIS ─────────────────────────────────────────────────────────
function BannerCrisis() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div style={{ background: '#fff7ed', borderBottom: '1.5px solid #fed7aa', padding: '12px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 800 }}>🆘 ¿Estás en crisis?</span>
          {' '}En horario hábil dirígete a <strong>UPA o DAE</strong>.
          Fuera de horario ve a <strong>urgencias</strong>, llama al{' '}
          <a href="tel:#4141" style={{ color: '#92400e', fontWeight: 800 }}>#4141</a>
          {' '}o accede al{' '}
          <a href="https://www.programaquedatechile.cl" target="_blank" rel="noopener noreferrer"
            style={{ color: '#92400e', fontWeight: 800, textDecoration: 'underline' }}>
            chat del Programa Quédate
          </a>.
        </div>
        <button onClick={() => setVisible(false)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#92400e', fontSize: 18, padding: 0, flexShrink: 0,
        }}>×</button>
      </div>
    </div>
  );
}

// ─── MODAL DE RESERVA ─────────────────────────────────────────────────────────
function ModalReserva({ slot, onClose, onExito }: { slot: Slot; onClose: () => void; onExito: (s: Slot) => void }) {
  const p = PSICOLOGAS.find(x => x.id === slot.psicologa_id)!;
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [carrera, setCarrera] = useState('');
  const [correo, setCorreo] = useState('');
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const [verPolitica, setVerPolitica] = useState(false);

  async function handleReservar() {
    const e: Record<string, string> = {};
    if (!nombre.trim()) e.nombre = 'Requerido';
    if (!validarRut(rut)) e.rut = 'RUT inválido';
    if (!carrera) e.carrera = 'Requerido';
    if (!correo.includes('@')) e.correo = 'Correo inválido';
    if (!aceptaTerminos) e.terminos = 'Debes aceptar la política de privacidad para continuar';
    if (Object.keys(e).length) { setErrores(e); return; }
    setCargando(true);
    const { error } = await supabase.from('slots').update({
      disponible: false,
      nombre_estudiante: nombre.trim(),
      rut_estudiante: rut.trim(),
      carrera,
      correo_estudiante: correo.trim(),
    }).eq('id', slot.id);
    if (!error) {
      const psi = PSICOLOGAS.find(x => x.id === slot.psicologa_id);
      fetch('/api/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          correo: correo.trim(),
          psicologa: psi?.nombre,
          fechaRaw: slot.fecha,
          horaRaw: slot.hora,
        }),
      });
      onExito(slot);
    }
    setCargando(false);
  }

  return (
    <>
      {verPolitica && <PoliticaPrivacidad onClose={() => setVerPolitica(false)} />}
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}>
        <div style={{
          background: 'white', borderRadius: 20, padding: 24,
          width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: p.color, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13,
              }}>{p.avatar}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1a1040' }}>{p.nombre}</div>
                <div style={{ fontSize: 13, color: '#7b6fa0' }}>{formatFecha(slot.fecha)} · {slot.hora}</div>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: '#f5f3ff', border: 'none', borderRadius: 8,
              width: 32, height: 32, fontSize: 18, cursor: 'pointer', color: '#7b6fa0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#7b6fa0', display: 'block', marginBottom: 4 }}>Nombre completo</label>
              <input type="text" value={nombre} onChange={e => { setNombre(e.target.value); setErrores(p => ({...p, nombre: ''})); }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, boxSizing: 'border-box',
                  border: `1.5px solid ${errores.nombre ? '#e05a5a' : '#dcd7f0'}`, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              {errores.nombre && <div style={{ fontSize: 11, color: '#e05a5a', marginTop: 2 }}>{errores.nombre}</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#7b6fa0', display: 'block', marginBottom: 4 }}>RUT</label>
                <input type="text" value={rut} placeholder="12.345.678-9"
                  onChange={e => { setRut(e.target.value); setErrores(p => ({...p, rut: ''})); }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, boxSizing: 'border-box',
                    border: `1.5px solid ${errores.rut ? '#e05a5a' : '#dcd7f0'}`, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                {errores.rut && <div style={{ fontSize: 11, color: '#e05a5a', marginTop: 2 }}>{errores.rut}</div>}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#7b6fa0', display: 'block', marginBottom: 4 }}>Correo institucional</label>
                <input type="email" value={correo}
                  onChange={e => { setCorreo(e.target.value); setErrores(p => ({...p, correo: ''})); }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, boxSizing: 'border-box',
                    border: `1.5px solid ${errores.correo ? '#e05a5a' : '#dcd7f0'}`, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                {errores.correo && <div style={{ fontSize: 11, color: '#e05a5a', marginTop: 2 }}>{errores.correo}</div>}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#7b6fa0', display: 'block', marginBottom: 4 }}>Carrera</label>
              <select value={carrera} onChange={e => { setCarrera(e.target.value); setErrores(p => ({...p, carrera: ''})); }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, boxSizing: 'border-box',
                  border: `1.5px solid ${errores.carrera ? '#e05a5a' : '#dcd7f0'}`, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'white' }}>
                <option value="">Selecciona...</option>
                {CARRERAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errores.carrera && <div style={{ fontSize: 11, color: '#e05a5a', marginTop: 2 }}>{errores.carrera}</div>}
            </div>

            {/* Checkbox términos y condiciones */}
            <div style={{
              background: errores.terminos ? '#fff1f1' : '#f9f8ff',
              border: `1.5px solid ${errores.terminos ? '#fca5a5' : '#ede9f8'}`,
              borderRadius: 10, padding: '12px 14px',
            }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={aceptaTerminos}
                  onChange={e => { setAceptaTerminos(e.target.checked); setErrores(p => ({...p, terminos: ''})); }}
                  style={{ marginTop: 2, width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ fontSize: 12, color: '#4a4560', lineHeight: 1.5 }}>
                  He leído y acepto que mis datos personales (nombre, RUT, carrera y correo) serán tratados por la Unidad de Bienestar y Salud Mental UFT, con la única finalidad de gestionar mi atención.
                </span>
              </label>
              {errores.terminos && <div style={{ fontSize: 11, color: '#e05a5a', marginTop: 6 }}>{errores.terminos}</div>}
            </div>
          </div>

          <button onClick={handleReservar} disabled={cargando} style={{
            width: '100%', marginTop: 20, padding: 13,
            background: cargando ? '#a89ec0' : '#3d2f7a', color: 'white',
            border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15,
            cursor: cargando ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}>{cargando ? 'Agendando...' : 'Confirmar reserva'}</button>
        </div>
      </div>
    </>
  );
}

// ─── VISTA ESTUDIANTE ─────────────────────────────────────────────────────────
function VistaEstudiante({ slots, recargar }: { slots: Slot[]; recargar: () => void }) {
  const [psicologaFiltro, setPsicologaFiltro] = useState<number | null>(null);
  const [slotSel, setSlotSel] = useState<Slot | null>(null);
  const [exito, setExito] = useState<Slot | null>(null);

  const disponibles = slots.filter(s => s.disponible && !s.realizada);
  const filtrados = psicologaFiltro ? disponibles.filter(s => s.psicologa_id === psicologaFiltro) : disponibles;

  function handleExito(s: Slot) {
    setSlotSel(null);
    setExito(s);
    recargar();
  }

  if (exito) return (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: '#1a1040', marginBottom: 8 }}>¡Hora agendada!</h2>
      <p style={{ color: '#7b6fa0', marginBottom: 8 }}>{PSICOLOGAS.find(p => p.id === exito.psicologa_id)?.nombre}</p>
      <p style={{ fontWeight: 700, color: '#3d2f7a', marginBottom: 20 }}>{formatFecha(exito.fecha)} a las {exito.hora}</p>
      <a href={buildGoogleCalendarUrl({
        titulo: `Sesión Bienestar Estudiantil — ${PSICOLOGAS.find(p => p.id === exito.psicologa_id)?.nombre}`,
        fecha: exito.fecha, hora: exito.hora,
        descripcion: `Sesión de atención psicológica en Bienestar Estudiantil UFT.\nPsicóloga: ${PSICOLOGAS.find(p => p.id === exito.psicologa_id)?.nombre}\nContacto: ${CORREO_BIENESTAR}`,
      })} target="_blank" rel="noopener noreferrer" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: '100%', padding: '12px', background: '#f0fdf4', border: '1.5px solid #86efac',
        borderRadius: 12, fontWeight: 700, fontSize: 14, color: '#166534',
        textDecoration: 'none', boxSizing: 'border-box', marginBottom: 12,
      }}>📅 Agregar a Google Calendar</a>
      <button onClick={() => setExito(null)} style={{
        width: '100%', padding: '12px 28px', background: '#3d2f7a', color: 'white',
        border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14,
        cursor: 'pointer', fontFamily: 'inherit',
      }}>Agendar otra hora</button>
    </div>
  );

  return (
    <div>
      {slotSel && <ModalReserva slot={slotSel} onClose={() => setSlotSel(null)} onExito={handleExito} />}
      <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1a1040', marginBottom: 4 }}>Agendar hora</h2>
      <p style={{ color: '#7b6fa0', marginBottom: 20, fontSize: 14 }}>Selecciona un horario disponible</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <button onClick={() => setPsicologaFiltro(null)} style={{
          padding: '8px 14px', borderRadius: 8, border: '1.5px solid',
          borderColor: psicologaFiltro === null ? '#3d2f7a' : '#dcd7f0',
          background: psicologaFiltro === null ? '#3d2f7a' : 'white',
          color: psicologaFiltro === null ? 'white' : '#7b6fa0',
          fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
        }}>Cualquier psicóloga</button>
        {PSICOLOGAS.map(p => (
          <button key={p.id} onClick={() => setPsicologaFiltro(p.id)} style={{
            padding: '8px 14px', borderRadius: 8, border: '1.5px solid',
            borderColor: psicologaFiltro === p.id ? p.color : '#dcd7f0',
            background: psicologaFiltro === p.id ? p.color : 'white',
            color: psicologaFiltro === p.id ? 'white' : '#7b6fa0',
            fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>{p.nombre}</button>
        ))}
      </div>
      {filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#a89ec0' }}>No hay horarios disponibles</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map(s => {
            const p = PSICOLOGAS.find(x => x.id === s.psicologa_id)!;
            return (
              <div key={s.id} style={{
                background: 'white', borderRadius: 14, padding: 16, border: '1.5px solid #ede9f8',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: p.color, color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12,
                  }}>{p.avatar}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1040' }}>{p.nombre}</div>
                    <div style={{ fontSize: 12, color: '#7b6fa0' }}>{formatFecha(s.fecha)} · {s.hora}</div>
                  </div>
                </div>
                <button onClick={() => setSlotSel(s)} style={{
                  padding: '8px 16px', background: '#3d2f7a', color: 'white',
                  border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>Reservar</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── VISTA CANCELAR ───────────────────────────────────────────────────────────
function VistaCancelar({ slots, recargar }: { slots: Slot[]; recargar: () => void }) {
  const [rut, setRut] = useState('');
  const [rutBuscado, setRutBuscado] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const misReservas = rutBuscado
    ? slots.filter(s => !s.disponible && !s.realizada &&
        s.rut_estudiante?.replace(/[.\-]/g, '') === rutBuscado.replace(/[.\-]/g, ''))
    : [];

  function buscar() {
    if (!validarRut(rut)) { setError('RUT inválido'); return; }
    setError(''); setRutBuscado(rut);
  }

  async function handleCancelar(s: Slot) {
    setCargando(true);
    await supabase.from('slots').update({
      disponible: true, nombre_estudiante: null,
      rut_estudiante: null, carrera: null, correo_estudiante: null,
    }).eq('id', s.id);

    // Notificar cancelación a psicóloga y bienestar
    fetch('/api/send-cancellation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: s.nombre_estudiante,
        correo: s.correo_estudiante,
        psicologaId: s.psicologa_id,
        fechaRaw: s.fecha,
        horaRaw: s.hora,
      }),
    });

    recargar();
    setCargando(false);
  }

  function buildCorreo(s: Slot) {
    const p = PSICOLOGAS.find(x => x.id === s.psicologa_id);
    const subject = encodeURIComponent(`Solicitud de cancelación — ${s.nombre_estudiante}`);
    const body = encodeURIComponent(
      `Estimado equipo de Bienestar y Salud Mental,\n\nSolicito cancelar mi sesión con menos de 24 horas de anticipación.\n\n` +
      `Mis datos:\n• Nombre: ${s.nombre_estudiante}\n• RUT: ${s.rut_estudiante}\n` +
      `• Correo: ${s.correo_estudiante}\n• Psicóloga: ${p?.nombre}\n` +
      `• Fecha y hora: ${formatFecha(s.fecha)} a las ${s.hora}\n\nSaludos`
    );
    return `mailto:${CORREO_BIENESTAR}?subject=${subject}&body=${body}`;
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1a1040', marginBottom: 4 }}>Cancelar hora</h2>
      <p style={{ color: '#7b6fa0', marginBottom: 20, fontSize: 14 }}>Ingresa tu RUT para ver tus reservas activas</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input value={rut} onChange={e => { setRut(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && buscar()} placeholder="12.345.678-9"
          style={{ flex: 1, padding: '10px 14px', borderRadius: 10, boxSizing: 'border-box',
            border: `1.5px solid ${error ? '#e05a5a' : '#dcd7f0'}`, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        <button onClick={buscar} style={{
          padding: '10px 20px', background: '#3d2f7a', color: 'white',
          border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Buscar</button>
      </div>
      {error && <div style={{ fontSize: 12, color: '#e05a5a', marginBottom: 12 }}>{error}</div>}
      {rutBuscado && misReservas.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#a89ec0' }}>No tienes horas reservadas</div>
      )}
      {misReservas.map(s => {
        const p = PSICOLOGAS.find(x => x.id === s.psicologa_id)!;
        const urgente = horasHasta(s.fecha, s.hora) < 24;
        return (
          <div key={s.id} style={{ background: 'white', borderRadius: 14, padding: 16, border: '1.5px solid #ede9f8', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: p.color, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12 }}>{p.avatar}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1040' }}>{p.nombre}</div>
                <div style={{ fontSize: 12, color: '#7b6fa0' }}>{formatFecha(s.fecha)} · {s.hora}</div>
              </div>
            </div>
            {urgente && (
              <div style={{ background: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 13 }}>
                ⚠️ Faltan menos de 24 horas. Debes contactar a bienestar por correo.
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginTop: 4 }}>📧 {CORREO_BIENESTAR}</div>
              </div>
            )}
            {urgente ? (
              <a href={buildCorreo(s)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '11px', background: '#fef3c7', border: '1.5px solid #fcd34d',
                borderRadius: 10, fontWeight: 700, fontSize: 13, color: '#92400e',
                textDecoration: 'none', boxSizing: 'border-box',
              }}>✉️ Enviar correo de cancelación</a>
            ) : (
              <button onClick={() => handleCancelar(s)} disabled={cargando} style={{
                width: '100%', padding: '11px', background: '#fff1f1', border: '1.5px solid #fca5a5',
                borderRadius: 10, fontWeight: 700, fontSize: 13, color: '#b91c1c',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancelar esta hora</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getRangoSemanaActual() {
  const hoy = new Date();
  const dow = hoy.getDay(); // 0=domingo
  const offsetLunes = dow === 0 ? -6 : 1 - dow;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + offsetLunes);
  const viernes = new Date(lunes);
  viernes.setDate(lunes.getDate() + 4);
  const fmt = fmtLocal;
  return { inicio: fmt(lunes), fin: fmt(viernes) };
}

interface SlotLog {
  id: string;
  slot_id: string | null;
  psicologa_id: number;
  fecha: string;
  hora: string | null;
  reserva_tipo: string | null;
  accion: string;
  eliminado_en: string;
  fecha_fin?: string | null;
  motivo?: string | null;
}

async function registrarEliminacion(slot: Slot) {
  await supabase.from('slots_log').insert({
    slot_id: slot.id, psicologa_id: slot.psicologa_id, fecha: slot.fecha,
    hora: slot.hora, reserva_tipo: slot.reserva_tipo, accion: 'eliminado',
  });
}

async function registrarBloqueo(psicologaId: number, fechaInicio: string, fechaFin: string, motivo: string, accion: 'bloqueo_creado' | 'bloqueo_eliminado') {
  await supabase.from('slots_log').insert({
    psicologa_id: psicologaId, fecha: fechaInicio, fecha_fin: fechaFin,
    motivo: motivo || null, accion,
  });
}

async function cargarBitacora(): Promise<SlotLog[]> {
  const { data } = await supabase.from('slots_log').select('*').order('eliminado_en', { ascending: false }).limit(100);
  return (data as SlotLog[]) || [];
}

// ─── PANEL ADMIN ──────────────────────────────────────────────────────────────
function PanelAdmin({ slots, recargar, diasBloqueados }: { slots: Slot[]; recargar: () => void; diasBloqueados: DiaBloqueado[] }) {
  const mostrarBitacora = typeof window !== 'undefined' && window.location.search.includes('bitacora');
  const [tab, setTab] = useState<'horarios' | 'reservas' | 'bitacora'>('reservas');
  const [psicologaFiltro, setPsicologaFiltro] = useState<number>(1);
  const [cargando, setCargando] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHora, setNuevaHora] = useState('');
  const [nuevaPsi, setNuevaPsi] = useState<number>(1);
  const [msgExito, setMsgExito] = useState('');
  const [bloqueoInicio, setBloqueoInicio] = useState('');
  const [bloqueoFin, setBloqueoFin] = useState('');
  const [bloqueoMotivo, setBloqueoMotivo] = useState('');
  const [bitacora, setBitacora] = useState<SlotLog[]>([]);
  const [bitacoraAuth, setBitacoraAuth] = useState(false);
  const [bitacoraPassInput, setBitacoraPassInput] = useState('');
  const [bitacoraError, setBitacoraError] = useState(false);

  useEffect(() => {
    if (tab === 'bitacora' && bitacoraAuth) cargarBitacora().then(setBitacora);
  }, [tab, bitacoraAuth]);

  function handleBitacoraLogin() {
    if (bitacoraPassInput === BITACORA_PASS) { setBitacoraAuth(true); setBitacoraError(false); }
    else setBitacoraError(true);
  }

  const { inicio: inicioSemana, fin: finSemana } = getRangoSemanaActual();
  const conteoSemanal = (psiId: number) =>
    slots.filter(s => s.psicologa_id === psiId && s.fecha >= inicioSemana && s.fecha <= finSemana).length;

  const reservasActivas = slots.filter(s => s.psicologa_id === psicologaFiltro && !s.disponible && !s.realizada);
  const horariosDisponibles = slots.filter(s => s.psicologa_id === psicologaFiltro && s.disponible);

  const [notificarEstudiantes, setNotificarEstudiantes] = useState(true);

  async function bloquearRango() {
    if (!bloqueoInicio || !bloqueoFin) return;
    setCargando(true);
    const aEliminar = slots.filter(s =>
      s.psicologa_id === psicologaFiltro && s.disponible &&
      s.fecha >= bloqueoInicio && s.fecha <= bloqueoFin
    );
    for (const s of aEliminar) {
      await registrarEliminacion(s);
      await supabase.from('slots').delete().eq('id', s.id);
    }

    const aCancelar = slots.filter(s =>
      s.psicologa_id === psicologaFiltro && !s.disponible && !s.realizada &&
      s.fecha >= bloqueoInicio && s.fecha <= bloqueoFin
    );
    let notificados = 0;
    if (notificarEstudiantes) {
      for (const s of aCancelar) {
        if (s.correo_estudiante) {
          try {
            await fetch('/api/send-cancelacion-fuerza-mayor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nombre: s.nombre_estudiante, correo: s.correo_estudiante,
                psicologaId: s.psicologa_id, fechaRaw: s.fecha, horaRaw: s.hora,
                motivo: bloqueoMotivo,
              }),
            });
            notificados++;
          } catch { /* si falla el correo, igual liberamos el horario */ }
        }
        await registrarEliminacion(s);
        await supabase.from('slots').update({
          disponible: true, nombre_estudiante: null, rut_estudiante: null,
          carrera: null, correo_estudiante: null,
        }).eq('id', s.id);
      }
    }

    await supabase.from('dias_bloqueados').insert({
      psicologa_id: psicologaFiltro, fecha_inicio: bloqueoInicio, fecha_fin: bloqueoFin,
      motivo: bloqueoMotivo || null,
    });
    await registrarBloqueo(psicologaFiltro, bloqueoInicio, bloqueoFin, bloqueoMotivo, 'bloqueo_creado');
    setMsgExito(
      `✅ Bloqueado del ${bloqueoInicio} al ${bloqueoFin} (${aEliminar.length} horarios liberados` +
      (notificarEstudiantes && aCancelar.length > 0 ? `, ${notificados}/${aCancelar.length} estudiante(s) notificado(s))` : ')')
    );
    setTimeout(() => setMsgExito(''), 5000);
    setBloqueoInicio(''); setBloqueoFin(''); setBloqueoMotivo('');
    recargar();
    setCargando(false);
  }

  async function desbloquear(id: string) {
    setCargando(true);
    const b = diasBloqueados.find(x => x.id === id);
    if (b) await registrarBloqueo(b.psicologa_id, b.fecha_inicio, b.fecha_fin, b.motivo || '', 'bloqueo_eliminado');
    await supabase.from('dias_bloqueados').delete().eq('id', id);
    recargar();
    setCargando(false);
  }

  const bloqueosPsicologa = diasBloqueados.filter(b => b.psicologa_id === psicologaFiltro);
  const reservasEnRangoBloqueo = (b: DiaBloqueado) =>
    slots.filter(s => s.psicologa_id === b.psicologa_id && !s.disponible && !s.realizada && s.fecha >= b.fecha_inicio && s.fecha <= b.fecha_fin);

  async function agregarHorario() {
    if (!nuevaFecha || !nuevaHora) return;
    const existe = slots.find(s => s.psicologa_id === nuevaPsi && s.fecha === nuevaFecha && s.hora === nuevaHora);
    if (existe) { setMsgExito('⚠️ Ese horario ya existe'); setTimeout(() => setMsgExito(''), 3000); return; }
    setCargando(true);
    await supabase.from('slots').insert({
      psicologa_id: nuevaPsi, fecha: nuevaFecha, hora: nuevaHora,
      disponible: true, realizada: false, reserva_tipo: 'manual',
      nombre_estudiante: null, rut_estudiante: null, carrera: null, correo_estudiante: null,
    });
    setMsgExito('✅ Horario agregado');
    setTimeout(() => setMsgExito(''), 3000);
    setNuevaFecha(''); setNuevaHora('');
    recargar();
    setCargando(false);
  }

  async function eliminarHorario(id: string) {
    const slot = slots.find(s => s.id === id);
    setCargando(true);
    if (slot) await registrarEliminacion(slot);
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
    await supabase.from('slots').update({
      disponible: true, nombre_estudiante: null,
      rut_estudiante: null, carrera: null, correo_estudiante: null,
    }).eq('id', id);
    recargar();
    setCargando(false);
  }

  const fechasProximas = getFechasProximas(60);

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1a1040', marginBottom: 4 }}>Panel de psicólogas</h2>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #ede9f8' }}>
        {([['reservas', '📋 Reservas activas'], ['horarios', '🗓 Gestionar horarios'], ...(mostrarBitacora ? [['bitacora', '🕵️ Bitácora']] : [])] as [typeof tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 16px', border: 'none', background: 'none',
            fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            color: tab === t ? '#3d2f7a' : '#a89ec0',
            borderBottom: tab === t ? '2px solid #3d2f7a' : '2px solid transparent',
            marginBottom: -2,
          }}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {PSICOLOGAS.map(p => {
          const conteo = conteoSemanal(p.id);
          const objetivo = PLANTILLA_FIJA[p.id]?.length ?? 6;
          return (
            <button key={p.id} onClick={() => setPsicologaFiltro(p.id)} style={{
              padding: '8px 14px', borderRadius: 8, border: '1.5px solid',
              borderColor: psicologaFiltro === p.id ? p.color : '#dcd7f0',
              background: psicologaFiltro === p.id ? p.color : 'white',
              color: psicologaFiltro === p.id ? 'white' : '#7b6fa0',
              fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {p.nombre}
              <span style={{
                fontSize: 11, fontWeight: 900, padding: '1px 7px', borderRadius: 20,
                background: psicologaFiltro === p.id ? 'rgba(255,255,255,0.25)' : (conteo < objetivo ? '#fff1f1' : '#f0fdf4'),
                color: psicologaFiltro === p.id ? 'white' : (conteo < objetivo ? '#b91c1c' : '#166534'),
              }}>{conteo}/{objetivo}</span>
            </button>
          );
        })}
      </div>

      {tab === 'bitacora' && !bitacoraAuth && (
        <div style={{ maxWidth: 320, margin: '30px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔒</div>
          <p style={{ color: '#7b6fa0', marginBottom: 16, fontSize: 13 }}>Contraseña de bitácora (solo Ignacia)</p>
          <input type="password" value={bitacoraPassInput}
            onChange={e => { setBitacoraPassInput(e.target.value); setBitacoraError(false); }}
            onKeyDown={e => e.key === 'Enter' && handleBitacoraLogin()}
            placeholder="Contraseña"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, boxSizing: 'border-box',
              border: `1.5px solid ${bitacoraError ? '#e05a5a' : '#dcd7f0'}`,
              fontSize: 13, marginBottom: 8, fontFamily: 'inherit', outline: 'none' }} />
          {bitacoraError && <div style={{ fontSize: 12, color: '#e05a5a', marginBottom: 8 }}>Contraseña incorrecta</div>}
          <button onClick={handleBitacoraLogin} style={{
            width: '100%', padding: 10, background: '#3d2f7a', color: 'white',
            border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>Ingresar</button>
        </div>
      )}

      {tab === 'bitacora' && bitacoraAuth && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#a89ec0', marginBottom: 4 }}>Últimos movimientos (todas las psicólogas)</div>
          {bitacora.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#a89ec0' }}>Sin movimientos registrados</div>
          ) : (
            bitacora.map(log => (
              <div key={log.id} style={{ background: 'white', borderRadius: 10, padding: '10px 14px', border: '1.5px solid #ede9f8', fontSize: 13 }}>
                <strong>{PSICOLOGAS.find(p => p.id === log.psicologa_id)?.nombre}</strong>
                {log.accion === 'eliminado' && (
                  <>
                    {' · 🗑 eliminó '}{formatFecha(log.fecha)} · {log.hora}
                    {log.reserva_tipo === 'fijo' && <span style={{ color: '#b91c1c', fontWeight: 700 }}> (era fijo)</span>}
                  </>
                )}
                {log.accion === 'bloqueo_creado' && (
                  <>
                    {' · 🏖 bloqueó del '}{formatFecha(log.fecha)}{' al '}{log.fecha_fin && formatFecha(log.fecha_fin)}
                    {log.motivo && <span style={{ color: '#7b6fa0' }}> — {log.motivo}</span>}
                  </>
                )}
                {log.accion === 'bloqueo_eliminado' && (
                  <>
                    {' · ✅ desbloqueó del '}{formatFecha(log.fecha)}{' al '}{log.fecha_fin && formatFecha(log.fecha_fin)}
                    {log.motivo && <span style={{ color: '#7b6fa0' }}> — {log.motivo}</span>}
                  </>
                )}
                <div style={{ fontSize: 11, color: '#a89ec0', marginTop: 2 }}>
                  {new Date(log.eliminado_en).toLocaleString('es-CL')}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'reservas' && (
        <>
          {reservasActivas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#a89ec0' }}>No hay reservas activas</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reservasActivas.map(s => (
                <div key={s.id} style={{ background: 'white', borderRadius: 14, padding: 16, border: '1.5px solid #ede9f8' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1040', marginBottom: 4 }}>{s.nombre_estudiante}</div>
                  <div style={{ fontSize: 13, color: '#7b6fa0', marginBottom: 2 }}>{formatFecha(s.fecha)} · {s.hora}</div>
                  <div style={{ fontSize: 13, color: '#7b6fa0', marginBottom: 2 }}>RUT: {s.rut_estudiante} · Carrera: {s.carrera}</div>
                  <div style={{ fontSize: 13, color: '#7b6fa0', marginBottom: 12 }}>📧 {s.correo_estudiante}</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <a href={buildGoogleCalendarUrl({
                      titulo: `Sesión con ${s.nombre_estudiante}`,
                      fecha: s.fecha, hora: s.hora,
                      descripcion: `Estudiante: ${s.nombre_estudiante}\nRUT: ${s.rut_estudiante}\nCarrera: ${s.carrera}\nCorreo: ${s.correo_estudiante}`,
                    })} target="_blank" rel="noopener noreferrer" style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px', background: '#f0fdf4', border: '1.5px solid #86efac',
                      borderRadius: 9, fontWeight: 700, fontSize: 12, color: '#166534',
                      textDecoration: 'none', boxSizing: 'border-box',
                    }}>📅 Google Calendar</a>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => marcarRealizada(s.id)} disabled={cargando} style={{
                      flex: 1, padding: '9px', background: '#f0fdf4', border: '1.5px solid #86efac',
                      borderRadius: 9, fontWeight: 700, fontSize: 12, color: '#166534', cursor: 'pointer', fontFamily: 'inherit',
                    }}>✓ Marcar como realizada</button>
                    <button onClick={() => cancelarAdmin(s.id)} disabled={cargando} style={{
                      flex: 1, padding: '9px', background: '#fff1f1', border: '1.5px solid #fca5a5',
                      borderRadius: 9, fontWeight: 700, fontSize: 12, color: '#b91c1c', cursor: 'pointer', fontFamily: 'inherit',
                    }}>🗑 Cancelar reserva</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'horarios' && (
        <>
          <div style={{ background: '#fffbea', borderRadius: 14, padding: 16, border: '1.5px solid #fde68a', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1040', marginBottom: 4 }}>
              🏖 Bloquear días ({PSICOLOGAS.find(p => p.id === psicologaFiltro)?.nombre})
            </div>
            <div style={{ fontSize: 12, color: '#92702a', marginBottom: 12 }}>
              Para vacaciones o licencias: libera los horarios del rango (los que no estén reservados) y evita que se vuelvan a generar solos mientras dure.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#7b6fa0', display: 'block', marginBottom: 4 }}>Desde</label>
                <input type="date" value={bloqueoInicio} onChange={e => setBloqueoInicio(e.target.value)} style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box',
                  border: '1.5px solid #dcd7f0', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'white',
                }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#7b6fa0', display: 'block', marginBottom: 4 }}>Hasta</label>
                <input type="date" value={bloqueoFin} onChange={e => setBloqueoFin(e.target.value)} style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box',
                  border: '1.5px solid #dcd7f0', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'white',
                }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#7b6fa0', display: 'block', marginBottom: 4 }}>Motivo (opcional)</label>
                <input type="text" value={bloqueoMotivo} onChange={e => setBloqueoMotivo(e.target.value)} placeholder="Vacaciones"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box',
                  border: '1.5px solid #dcd7f0', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'white' }} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={notificarEstudiantes} onChange={e => setNotificarEstudiantes(e.target.checked)} />
              <span style={{ fontSize: 12, color: '#92702a' }}>
                Si hay estudiantes ya agendados en el rango, cancelar sus horas y avisarles por correo (el correo dice "fuerza mayor", sin detalle — el motivo que escribas arriba queda solo interno, en la bitácora)
              </span>
            </label>
            <button onClick={bloquearRango} disabled={cargando || !bloqueoInicio || !bloqueoFin} style={{
              width: '100%', padding: 11, background: !bloqueoInicio || !bloqueoFin ? '#f0e6c0' : '#92702a',
              color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
              cursor: !bloqueoInicio || !bloqueoFin ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}>Bloquear rango</button>

            {bloqueosPsicologa.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bloqueosPsicologa.map(b => {
                  const reservasAfectadas = reservasEnRangoBloqueo(b);
                  return (
                    <div key={b.id} style={{ background: 'white', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1040' }}>{formatFecha(b.fecha_inicio)} → {formatFecha(b.fecha_fin)}</div>
                        {b.motivo && <div style={{ fontSize: 12, color: '#7b6fa0' }}>{b.motivo}</div>}
                        {reservasAfectadas.length > 0 && (
                          <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
                            ⚠️ {reservasAfectadas.length} reserva(s) ya confirmada(s) en este rango — revísalas en "Reservas activas", el bloqueo no las cancela solo.
                          </div>
                        )}
                      </div>
                      <button onClick={() => desbloquear(b.id)} disabled={cargando} style={{
                        padding: '6px 12px', background: '#f0fdf4', border: '1.5px solid #86efac',
                        borderRadius: 8, fontWeight: 700, fontSize: 12, color: '#166534',
                        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                      }}>Desbloquear</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1.5px solid #ede9f8', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1040', marginBottom: 12 }}>➕ Agregar nuevo horario</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#7b6fa0', display: 'block', marginBottom: 4 }}>Psicóloga</label>
                <select value={nuevaPsi} onChange={e => setNuevaPsi(Number(e.target.value))} style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box',
                  border: '1.5px solid #dcd7f0', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'white',
                }}>
                  {PSICOLOGAS.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#7b6fa0', display: 'block', marginBottom: 4 }}>Fecha</label>
                <select value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box',
                  border: '1.5px solid #dcd7f0', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'white',
                }}>
                  <option value="">Selecciona...</option>
                  {fechasProximas.map(f => <option key={f} value={f}>{formatFecha(f)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#7b6fa0', display: 'block', marginBottom: 4 }}>Hora</label>
                <select value={nuevaHora} onChange={e => setNuevaHora(e.target.value)} style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box',
                  border: '1.5px solid #dcd7f0', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'white',
                }}>
                  <option value="">Selecciona...</option>
                  {HORAS_DISPONIBLES.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
            <button onClick={agregarHorario} disabled={cargando || !nuevaFecha || !nuevaHora} style={{
              width: '100%', padding: 11, background: !nuevaFecha || !nuevaHora ? '#dcd7f0' : '#3d2f7a',
              color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
              cursor: !nuevaFecha || !nuevaHora ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}>Agregar horario</button>
            {msgExito && <div style={{ fontSize: 13, textAlign: 'center', marginTop: 8, color: '#166534' }}>{msgExito}</div>}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1040', marginBottom: 12 }}>
            Horarios disponibles de {PSICOLOGAS.find(p => p.id === psicologaFiltro)?.nombre}
          </div>
          {horariosDisponibles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#a89ec0' }}>No hay horarios — agrega uno arriba</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {horariosDisponibles.map(s => (
                <div key={s.id} style={{
                  background: 'white', borderRadius: 12, padding: '12px 16px', border: '1.5px solid #ede9f8',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 14, color: '#1a1040', fontWeight: 600 }}>{formatFecha(s.fecha)} · {s.hora}</div>
                    {s.reserva_tipo === 'fijo' && (
                      <div style={{ fontSize: 11, color: '#a89ec0', marginTop: 2 }}>🔁 Horario fijo — se vuelve a generar solo si se elimina</div>
                    )}
                  </div>
                  <button onClick={() => eliminarHorario(s.id)} disabled={cargando} style={{
                    padding: '6px 12px', background: '#fff1f1', border: '1.5px solid #fca5a5',
                    borderRadius: 8, fontWeight: 700, fontSize: 12, color: '#b91c1c',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>🗑 Eliminar</button>
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
  const [diasBloqueados, setDiasBloqueados] = useState<DiaBloqueado[]>([]);
  const [vista, setVista] = useState<'estudiante' | 'cancelar' | 'admin'>('estudiante');
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState(false);

  async function recargar() {
    const [data, bloqueos] = await Promise.all([cargarSlots(), cargarDiasBloqueados()]);
    setDiasBloqueados(bloqueos);
    const agregados = await asegurarHorariosFijos(data, bloqueos);
    setSlots(agregados > 0 ? await cargarSlots() : data);
  }

  useEffect(() => { recargar(); }, []);

  useEffect(() => {
    if (vista !== 'admin' || !adminAuth) return;
    const id = setInterval(recargar, 10000);
    return () => clearInterval(id);
  }, [vista, adminAuth]);

  function handleAdminLogin() {
    if (adminPass === ADMIN_PASS) { setAdminAuth(true); setAdminError(false); }
    else setAdminError(true);
  }

  if (slots === null) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#f0edfc,#e8f4fb)' }}>
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#f0edfc 0%,#e8f4fb 60%,#f9f0f5 100%)', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #e8e4f0', padding: '0 24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 62 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#3d2f7a,#7C6FAF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>🌿</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#1a1040' }}>Bienestar Estudiantil</div>
              <div style={{ fontSize: 11, color: '#a89ec0' }}>Agenda tu hora de atención</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {NAV.map(([val, label]) => (
              <button key={val} onClick={() => { setVista(val); if (val !== 'admin') { setAdminAuth(false); setAdminPass(''); setAdminError(false); } }} style={{
                padding: '7px 12px', borderRadius: 8,
                background: vista === val ? '#3d2f7a' : 'transparent',
                color: vista === val ? 'white' : '#7b6fa0',
                border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <BannerCrisis />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 80px' }}>
        {vista === 'estudiante' && <VistaEstudiante slots={slots} recargar={recargar} />}
        {vista === 'cancelar' && <VistaCancelar slots={slots} recargar={recargar} />}
        {vista === 'admin' && !adminAuth && (
          <div style={{ maxWidth: 360, margin: '60px auto', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1a1040', marginBottom: 6 }}>Panel de psicólogas</h2>
            <p style={{ color: '#7b6fa0', marginBottom: 24, fontSize: 14 }}>Ingresa la contraseña para acceder.</p>
            <input type="password" value={adminPass}
              onChange={e => { setAdminPass(e.target.value); setAdminError(false); }}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              placeholder="Contraseña"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, boxSizing: 'border-box',
                border: `1.5px solid ${adminError ? '#e05a5a' : '#dcd7f0'}`,
                fontSize: 14, marginBottom: 8, fontFamily: 'inherit', outline: 'none' }} />
            {adminError && <div style={{ fontSize: 12, color: '#e05a5a', marginBottom: 8 }}>Contraseña incorrecta</div>}
            <button onClick={handleAdminLogin} style={{
              width: '100%', padding: 12, background: '#3d2f7a', color: 'white',
              border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            }}>Ingresar</button>
          </div>
        )}
        {vista === 'admin' && adminAuth && <PanelAdmin slots={slots} recargar={recargar} diasBloqueados={diasBloqueados} />}
      </div>
    </div>
  );
}
