import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rumestjktglrodfoatre.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1bWVzdGprdGdscm9kZm9hdHJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDYxMDIsImV4cCI6MjA5NjE4MjEwMn0.FFnWHGSwgSCVIBfRsN7bG_BW1C5tuwOtSTGLaXslor4'
);

const RESEND_API_KEY = 're_QH9SGpPs_BxvEBseFtCKDwJJUAUyDqTZx';

const PSICOLOGAS: Record<number, string> = {
  1: 'Francesca Figueroa',
  2: 'Trinidad Montes',
  3: 'Andrea García',
};

function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split('-');
  const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return `${dias[dt.getDay()]} ${d} de ${meses[Number(m) - 1]}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Calcular fecha de mañana en Chile (UTC-4)
  const ahora = new Date();
  const manana = new Date(ahora);
  manana.setDate(ahora.getDate() + 1);
  const fechaManana = manana.toISOString().split('T')[0];

  // Buscar todas las sesiones reservadas para mañana
  const { data: slots, error } = await supabase
    .from('slots')
    .select('*')
    .eq('fecha', fechaManana)
    .eq('disponible', false)
    .eq('realizada', false);

  if (error) return res.status(500).json({ error });
  if (!slots || slots.length === 0) return res.status(200).json({ ok: true, enviados: 0 });

  let enviados = 0;

  for (const slot of slots) {
    if (!slot.correo_estudiante || !slot.nombre_estudiante) continue;

    const psicologa = PSICOLOGAS[slot.psicologa_id] || 'Psicóloga';
    const fechaFormateada = formatFecha(slot.fecha);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Bienestar y Salud Mental UFT <onboarding@resend.dev>',
        to: slot.correo_estudiante,
        subject: 'Recordatorio — Tienes una hora mañana · Bienestar y Salud Mental UFT',
        html: `
          <div style="font-family: 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #f9f8ff; border-radius: 16px;">
            <div style="background: linear-gradient(135deg, #3d2f7a, #7C6FAF); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <div style="font-size: 32px; margin-bottom: 8px;">🌿</div>
              <h1 style="color: white; font-size: 18px; margin: 0; font-weight: 900;">Bienestar y Salud Mental UFT</h1>
            </div>
            <p style="color: #1a1040; font-size: 15px;">Hola <strong>${slot.nombre_estudiante}</strong>,</p>
            <p style="color: #1a1040; font-size: 15px;">Te recordamos que mañana tienes una sesión agendada.</p>
            <div style="background: white; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1.5px solid #ede9f8;">
              <div style="margin-bottom: 10px;"><span style="color: #7b6fa0; font-size: 13px;">Psicóloga</span><br/><strong style="color: #1a1040;">${psicologa}</strong></div>
              <div style="margin-bottom: 10px;"><span style="color: #7b6fa0; font-size: 13px;">Fecha</span><br/><strong style="color: #1a1040;">${fechaFormateada}</strong></div>
              <div><span style="color: #7b6fa0; font-size: 13px;">Hora</span><br/><strong style="color: #1a1040;">${slot.hora}</strong></div>
            </div>
            <p style="color: #7b6fa0; font-size: 13px; line-height: 1.6;">
              Si necesitas cancelar, escríbenos a 
              <a href="mailto:bienestarysaludmental@uft.cl" style="color: #3d2f7a;">bienestarysaludmental@uft.cl</a>.
            </p>
            <p style="color: #a89ec0; font-size: 12px; margin-top: 24px; text-align: center;">Bienestar y Salud Mental UFT</p>
          </div>
        `,
      }),
    });

    if (response.ok) enviados++;
  }

  return res.status(200).json({ ok: true, enviados });
}
