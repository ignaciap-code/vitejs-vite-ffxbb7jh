import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rumestjktglrodfoatre.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1bWVzdGprdGdscm9kZm9hdHJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDYxMDIsImV4cCI6MjA5NjE4MjEwMn0.FFnWHGSwgSCVIBfRsN7bG_BW1C5tuwOtSTGLaXslor4'
);

const RESEND_API_KEY = 're_QH9SGpPs_BxvEBseFtCKDwJJUAUyDqTZx';
const CORREO_BIENESTAR = 'bienestaruft@gmail.com';

const PSICOLOGAS: Record<number, { nombre: string; correo: string }> = {
  1: { nombre: 'Francesca Figueroa', correo: 'ffigueroa@uft.cl' },
  2: { nombre: 'Trinidad Montes', correo: 'tmontes@uft.cl' },
  3: { nombre: 'Andrea García', correo: 'andreagarcia@uft.cl' },
};

function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split('-');
  const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return `${dias[dt.getDay()]} ${d} de ${meses[Number(m) - 1]}`;
}

function buildCalendarLink(titulo: string, fechaRaw: string, horaRaw: string, descripcion: string, duracion = 60) {
  const [y, m, d] = fechaRaw.split('-').map(Number);
  const [h, min] = horaRaw.split(':').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(min)}00`;
  const end = new Date(y, m - 1, d, h, min + duracion);
  const endStr = `${end.getFullYear()}${pad(end.getMonth()+1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${start}/${endStr}&details=${encodeURIComponent(descripcion)}`;
}

async function enviarCorreo(to: string, subject: string, html: string) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: 'Bienestar y Salud Mental UFT <onboarding@resend.dev>', to, subject, html }),
  });
}

export default async function handler(req: any, res: any) {
  const ahora = new Date();
  const manana = new Date(ahora);
  manana.setDate(ahora.getDate() + 1);
  const fechaManana = manana.toISOString().split('T')[0];

  const { data: slots, error } = await supabase
    .from('slots').select('*')
    .eq('fecha', fechaManana)
    .eq('disponible', false)
    .eq('realizada', false);

  if (error) return res.status(500).json({ error });
  if (!slots || slots.length === 0) return res.status(200).json({ ok: true, enviados: 0 });

  let enviados = 0;

  for (const slot of slots) {
    if (!slot.correo_estudiante || !slot.nombre_estudiante) continue;

    const psiData = PSICOLOGAS[slot.psicologa_id];
    const psiNombre = psiData?.nombre || 'Psicóloga';
    const fechaFormateada = formatFecha(slot.fecha);

    const calendarLinkEstudiante = buildCalendarLink(
      `Sesión Bienestar Estudiantil — ${psiNombre}`, slot.fecha, slot.hora,
      `Sesión de atención psicológica en Bienestar Estudiantil UFT.\nPsicóloga: ${psiNombre}\nContacto: ${CORREO_BIENESTAR}`,
    );

    const calendarLinkPsicologa = buildCalendarLink(
      `Sesión con ${slot.nombre_estudiante}`, slot.fecha, slot.hora,
      `Estudiante: ${slot.nombre_estudiante}\nCorreo: ${slot.correo_estudiante}\nCarrera: ${slot.carrera}`,
    );

    await enviarCorreo(slot.correo_estudiante,
      'Recordatorio — Tienes una hora mañana · Bienestar y Salud Mental UFT',
      `<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9f8ff;border-radius:16px;">
        <div style="background:linear-gradient(135deg,#3d2f7a,#7C6FAF);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
          <div style="font-size:32px;margin-bottom:8px;">🌿</div>
          <h1 style="color:white;font-size:18px;margin:0;font-weight:900;">Bienestar y Salud Mental UFT</h1>
        </div>
        <p style="color:#1a1040;font-size:15px;">Hola <strong>${slot.nombre_estudiante}</strong>,</p>
        <p style="color:#1a1040;font-size:15px;">Te recordamos que mañana tienes una sesión agendada.</p>
        <div style="background:white;border-radius:12px;padding:20px;margin:20px 0;border:1.5px solid #ede9f8;">
          <div style="margin-bottom:10px;"><span style="color:#7b6fa0;font-size:13px;">Psicóloga</span><br/><strong>${psiNombre}</strong></div>
          <div style="margin-bottom:10px;"><span style="color:#7b6fa0;font-size:13px;">Fecha</span><br/><strong>${fechaFormateada}</strong></div>
          <div><span style="color:#7b6fa0;font-size:13px;">Hora</span><br/><strong>${slot.hora}</strong></div>
        </div>
        <a href="${calendarLinkEstudiante}" style="display:block;text-align:center;padding:12px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;font-weight:700;font-size:14px;color:#166534;text-decoration:none;margin-bottom:16px;">📅 Ver en Google Calendar</a>
        <p style="color:#7b6fa0;font-size:13px;">Si necesitas cancelar, escríbenos a <a href="mailto:bienestarysaludmental@uft.cl" style="color:#3d2f7a;">bienestarysaludmental@uft.cl</a>.</p>
        <p style="color:#a89ec0;font-size:12px;margin-top:24px;text-align:center;">Bienestar y Salud Mental UFT</p>
      </div>`
    );

    if (psiData?.correo) {
      await enviarCorreo(psiData.correo,
        `Recordatorio — Sesión mañana con ${slot.nombre_estudiante} · ${slot.hora}`,
        `<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9f8ff;border-radius:16px;">
          <h2 style="color:#1a1040;font-size:17px;margin-bottom:16px;">⏰ Recordatorio de sesión mañana</h2>
          <div style="background:white;border-radius:12px;padding:20px;border:1.5px solid #ede9f8;margin-bottom:16px;">
            <div style="margin-bottom:8px;"><span style="color:#7b6fa0;font-size:13px;">Estudiante</span><br/><strong>${slot.nombre_estudiante}</strong></div>
            <div style="margin-bottom:8px;"><span style="color:#7b6fa0;font-size:13px;">Correo</span><br/><strong>${slot.correo_estudiante}</strong></div>
            <div style="margin-bottom:8px;"><span style="color:#7b6fa0;font-size:13px;">Carrera</span><br/><strong>${slot.carrera}</strong></div>
            <div style="margin-bottom:8px;"><span style="color:#7b6fa0;font-size:13px;">Fecha</span><br/><strong>${fechaFormateada}</strong></div>
            <div><span style="color:#7b6fa0;font-size:13px;">Hora</span><br/><strong>${slot.hora}</strong></div>
          </div>
          <a href="${calendarLinkPsicologa}" style="display:block;text-align:center;padding:12px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;font-weight:700;font-size:14px;color:#166534;text-decoration:none;margin-bottom:16px;">📅 Agregar a Google Calendar</a>
          <p style="color:#a89ec0;font-size:12px;text-align:center;">Bienestar y Salud Mental UFT</p>
        </div>`
      );
    }

    enviados++;
  }

  return res.status(200).json({ ok: true, enviados });
}
