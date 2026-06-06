import type { VercelRequest, VercelResponse } from '@vercel/node';

const RESEND_API_KEY = 're_QH9SGpPs_BxvEBseFtCKDwJJUAUyDqTZx';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nombre, correo, psicologa, fecha, hora } = req.body;

  if (!nombre || !correo || !psicologa || !fecha || !hora) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Bienestar y Salud Mental UFT <onboarding@resend.dev>',
      to: correo,
      subject: 'Confirmación de hora — Bienestar y Salud Mental Estudiantil UFT',
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #f9f8ff; border-radius: 16px;">
          <div style="background: linear-gradient(135deg, #3d2f7a, #7C6FAF); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <div style="font-size: 32px; margin-bottom: 8px;">🌿</div>
            <h1 style="color: white; font-size: 18px; margin: 0; font-weight: 900;">Bienestar y Salud Mental UFT</h1>
          </div>
          <p style="color: #1a1040; font-size: 15px;">Hola <strong>${nombre}</strong>,</p>
          <p style="color: #1a1040; font-size: 15px;">Tu hora ha sido agendada exitosamente.</p>
          <div style="background: white; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1.5px solid #ede9f8;">
            <div style="margin-bottom: 10px;"><span style="color: #7b6fa0; font-size: 13px;">Psicóloga</span><br/><strong style="color: #1a1040;">${psicologa}</strong></div>
            <div style="margin-bottom: 10px;"><span style="color: #7b6fa0; font-size: 13px;">Fecha</span><br/><strong style="color: #1a1040;">${fecha}</strong></div>
            <div><span style="color: #7b6fa0; font-size: 13px;">Hora</span><br/><strong style="color: #1a1040;">${hora}</strong></div>
          </div>
          <p style="color: #7b6fa0; font-size: 13px; line-height: 1.6;">
            Si necesitas cancelar con más de 24 horas de anticipación, puedes hacerlo desde la app.<br/>
            Si es con menos de 24 horas, escríbenos a 
            <a href="mailto:bienestarysaludmental@uft.cl" style="color: #3d2f7a;">bienestarysaludmental@uft.cl</a>.
          </p>
          <p style="color: #a89ec0; font-size: 12px; margin-top: 24px; text-align: center;">Bienestar y Salud Mental UFT</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    return res.status(500).json({ error });
  }

  return res.status(200).json({ ok: true });
}
