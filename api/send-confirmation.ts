const RESEND_API_KEY = 're_QH9SGpPs_BxvEBseFtCKDwJJUAUyDqTZx';
const CORREO_BIENESTAR = 'bienestaruft@gmail.com';

const CORREOS_PSICOLOGAS: Record<string, string> = {
  'Francesca Figueroa': 'ffigueroa@uft.cl',
  'Trinidad Montes': 'tmontes@uft.cl',
  'Andrea García': 'andreagarcia@uft.cl',
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
    body: JSON.stringify({
      from: 'Bienestar y Salud Mental UFT <onboarding@resend.dev>',
      to, subject, html,
    }),
  });
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { nombre, correo, psicologa, fechaRaw, horaRaw } = await req.json();

  if (!nombre || !correo || !psicologa || !fechaRaw || !horaRaw) {
    return new Response('Faltan datos', { status: 400 });
  }

  const fechaFormateada = formatFecha(fechaRaw);
  const calendarLinkPsicologa = buildCalendarLink(
    `Sesión con ${nombre}`,
    fechaRaw, horaRaw,
    `Estudiante: ${nombre}\nCorreo: ${correo}\nPsicóloga: ${psicologa}`,
  );
  const calendarLinkEstudiante = buildCalendarLink(
    `Sesión Bienestar Estudiantil — ${psicologa}`,
    fechaRaw, horaRaw,
    `Sesión de atención psicológica en Bienestar Estudiantil UFT.\nPsicóloga: ${psicologa}\nContacto: ${CORREO_BIENESTAR}`,
  );

  // 1. Correo al estudiante
  await enviarCorreo(correo,
    'Confirmación de hora — Bienestar y Salud Mental Estudiantil UFT',
    `<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9f8ff;border-radius:16px;">
      <div style="background:linear-gradient(135deg,#3d2f7a,#7C6FAF);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
        <div style="font-size:32px;margin-bottom:8px;">🌿</div>
        <h1 style="color:white;font-size:18px;margin:0;font-weight:900;">Bienestar y Salud Mental UFT</h1>
      </div>
      <p style="color:#1a1040;font-size:15px;">Hola <strong>${nombre}</strong>,</p>
      <p style="color:#1a1040;font-size:15px;">Tu hora ha sido agendada exitosamente.</p>
      <div style="background:white;border-radius:12px;padding:20px;margin:20px 0;border:1.5px solid #ede9f8;">
        <div style="margin-bottom:10px;"><span style="color:#7b6fa0;font-size:13px;">Psicóloga</span><br/><strong style="color:#1a1040;">${psicologa}</strong></div>
        <div style="margin-bottom:10px;"><span style="color:#7b6fa0;font-size:13px;">Fecha</span><br/><strong style="color:#1a1040;">${fechaFormateada}</strong></div>
        <div><span style="color:#7b6fa0;font-size:13px;">Hora</span><br/><strong style="color:#1a1040;">${horaRaw}</strong></div>
      </div>
      <a href="${calendarLinkEstudiante}" style="display:block;text-align:center;padding:12px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;font-weight:700;font-size:14px;color:#166534;text-decoration:none;margin-bottom:16px;">📅 Agregar a Google Calendar</a>
      <p style="color:#7b6fa0;font-size:13px;line-height:1.6;">Si necesitas cancelar con más de 24 horas de anticipación, puedes hacerlo desde la app. Si es con menos de 24 horas, escríbenos a <a href="mailto:${CORREO_BIENESTAR}" style="color:#3d2f7a;">${CORREO_BIENESTAR}</a>.</p>
      <p style="color:#a89ec0;font-size:12px;margin-top:24px;text-align:center;">Bienestar y Salud Mental UFT</p>
    </div>`
  );

  // 2. Correo a bienestar
  await enviarCorreo(CORREO_BIENESTAR,
    `Nueva reserva — ${nombre} con ${psicologa}`,
    `<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9f8ff;border-radius:16px;">
      <h2 style="color:#1a1040;font-size:17px;margin-bottom:16px;">🗓 Nueva reserva agendada</h2>
      <div style="background:white;border-radius:12px;padding:20px;border:1.5px solid #ede9f8;margin-bottom:16px;">
        <div style="margin-bottom:8px;"><span style="color:#7b6fa0;font-size:13px;">Estudiante</span><br/><strong>${nombre}</strong></div>
        <div style="margin-bottom:8px;"><span style="color:#7b6fa0;font-size:13px;">Correo</span><br/><strong>${correo}</strong></div>
        <div style="margin-bottom:8px;"><span style="color:#7b6fa0;font-size:13px;">Psicóloga</span><br/><strong>${psicologa}</strong></div>
        <div style="margin-bottom:8px;"><span style="color:#7b6fa0;font-size:13px;">Fecha</span><br/><strong>${fechaFormateada}</strong></div>
        <div><span style="color:#7b6fa0;font-size:13px;">Hora</span><br/><strong>${horaRaw}</strong></div>
      </div>
      <p style="color:#a89ec0;font-size:12px;text-align:center;">Bienestar y Salud Mental UFT</p>
    </div>`
  );

  // 3. Correo a la psicóloga
  const correoPsicologa = CORREOS_PSICOLOGAS[psicologa];
  if (correoPsicologa) {
    await enviarCorreo(correoPsicologa,
      `Nueva sesión agendada — ${nombre} · ${fechaFormateada} ${horaRaw}`,
      `<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9f8ff;border-radius:16px;">
        <h2 style="color:#1a1040;font-size:17px;margin-bottom:16px;">🗓 Nueva sesión agendada</h2>
        <div style="background:white;border-radius:12px;padding:20px;border:1.5px solid #ede9f8;margin-bottom:16px;">
          <div style="margin-bottom:8px;"><span style="color:#7b6fa0;font-size:13px;">Estudiante</span><br/><strong>${nombre}</strong></div>
          <div style="margin-bottom:8px;"><span style="color:#7b6fa0;font-size:13px;">Correo</span><br/><strong>${correo}</strong></div>
          <div style="margin-bottom:8px;"><span style="color:#7b6fa0;font-size:13px;">Fecha</span><br/><strong>${fechaFormateada}</strong></div>
          <div><span style="color:#7b6fa0;font-size:13px;">Hora</span><br/><strong>${horaRaw}</strong></div>
        </div>
        <a href="${calendarLinkPsicologa}" style="display:block;text-align:center;padding:12px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;font-weight:700;font-size:14px;color:#166534;text-decoration:none;margin-bottom:16px;">📅 Agregar a Google Calendar</a>
        <p style="color:#a89ec0;font-size:12px;text-align:center;">Bienestar y Salud Mental UFT</p>
      </div>`
    );
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
