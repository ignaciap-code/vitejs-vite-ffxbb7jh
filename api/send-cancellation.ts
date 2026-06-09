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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nombre, correo, psicologaId, fechaRaw, horaRaw } = req.body;
  if (!nombre || !psicologaId || !fechaRaw || !horaRaw) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  const psiData = PSICOLOGAS[psicologaId];
  const psiNombre = psiData?.nombre || 'Psicóloga';
  const fechaFormateada = formatFecha(fechaRaw);

  const calendarLink = buildCalendarLink(
    `[CANCELADA] Sesión con ${nombre}`, fechaRaw, horaRaw,
    `Esta sesión fue cancelada por el/la estudiante.\nEstudiante: ${nombre}\nCorreo: ${correo || 'no disponible'}`,
  );

  const html = `
    <div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff5f5;border-radius:16px;">
      <h2 style="color:#b91c1c;font-size:17px;margin-bottom:16px;">❌ Hora cancelada</h2>
      <div style="background:white;border-radius:12px;padding:20px;border:1.5px solid #fca5a5;margin-bottom:16px;">
        <div style="margin-bottom:8px;"><span style="color:#7b6fa0;font-size:13px;">Estudiante</span><br/><strong>${nombre}</strong></div>
        ${correo ? `<div style="margin-bottom:8px;"><span style="color:#7b6fa0;font-size:13px;">Correo</span><br/><strong>${correo}</strong></div>` : ''}
        <div style="margin-bottom:8px;"><span style="color:#7b6fa0;font-size:13px;">Psicóloga</span><br/><strong>${psiNombre}</strong></div>
        <div style="margin-bottom:8px;"><span style="color:#7b6fa0;font-size:13px;">Fecha</span><br/><strong>${fechaFormateada}</strong></div>
        <div><span style="color:#7b6fa0;font-size:13px;">Hora</span><br/><strong>${horaRaw}</strong></div>
      </div>
      <a href="${calendarLink}" style="display:block;text-align:center;padding:12px;background:#fff1f1;border:1.5px solid #fca5a5;border-radius:10px;font-weight:700;font-size:14px;color:#b91c1c;text-decoration:none;margin-bottom:16px;">📅 Registrar cancelación en Google Calendar</a>
      <p style="color:#7b6fa0;font-size:12px;">El evento quedará marcado como <strong>[CANCELADA]</strong> en tu calendario.</p>
      <p style="color:#a89ec0;font-size:12px;margin-top:24px;text-align:center;">Bienestar y Salud Mental UFT</p>
    </div>
  `;

  if (psiData?.correo) {
    await enviarCorreo(psiData.correo, `[CANCELADA] Sesión con ${nombre} · ${fechaFormateada} ${horaRaw}`, html);
  }
  await enviarCorreo(CORREO_BIENESTAR, `[CANCELADA] Sesión con ${nombre} · ${fechaFormateada} ${horaRaw}`, html);

  return res.status(200).json({ ok: true });
}
