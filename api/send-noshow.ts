import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { nombre, correo, psicologa, fechaRaw, horaRaw } = req.body;

  const fecha = new Date(`${fechaRaw}T12:00:00`).toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const html = `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #f9f8ff; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 40px;">🌿</span>
        <h2 style="color: #3d2f7a; margin: 8px 0 4px; font-size: 20px;">Equipo de Bienestar Estudiantil</h2>
        <p style="color: #a89ec0; font-size: 13px; margin: 0;">Universidad Finis Terrae</p>
      </div>

      <div style="background: white; border-radius: 12px; padding: 24px; border: 1.5px solid #ede9f8; margin-bottom: 20px;">
        <p style="color: #1a1040; font-size: 15px; margin: 0 0 12px;">Hola <strong>${nombre}</strong>,</p>
        <p style="color: #4a4560; font-size: 14px; line-height: 1.7; margin: 0 0 12px;">
          Hoy te esperamos en tu hora con <strong>${psicologa}</strong> el ${fecha} a las <strong>${horaRaw}</strong>, pero no pudimos verte. ¿Estás bien? Esperamos que todo esté en orden.
        </p>
        <p style="color: #4a4560; font-size: 14px; line-height: 1.7; margin: 0 0 12px;">
          Queremos recordarte que cada hora de atención que no se utiliza ni se avisa con anticipación es una oportunidad que otro estudiante que la necesita pierde. Por eso, si en algún momento no puedes asistir, te pedimos que nos avises para liberar ese espacio.
        </p>
        <p style="color: #4a4560; font-size: 14px; line-height: 1.7; margin: 0;">
          Si necesitas reagendar o tienes alguna consulta, escríbenos a <a href="mailto:bienestarysaludmental@uft.cl" style="color: #3d2f7a; font-weight: 700;">bienestarysaludmental@uft.cl</a> o acércate a nuestro mesón en la DAE.
        </p>
      </div>

      <div style="background: #fff7ed; border-radius: 10px; padding: 14px 18px; border-left: 4px solid #fdba74; margin-bottom: 20px;">
        <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.6;">
          ⚠️ <strong>Importante:</strong> Tu RUT ha quedado bloqueado para agendar en línea. Para reagendar, deberás acercarte presencialmente al mesón de la DAE o escribirnos al correo indicado arriba.
        </p>
      </div>

      <p style="color: #a89ec0; font-size: 12px; text-align: center; margin: 0;">
        Bienestar y Salud Mental · Dirección de Asuntos Estudiantiles · UFT
      </p>
    </div>
  `;

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY!,
      },
      body: JSON.stringify({
        sender: { name: 'Bienestar UFT', email: 'bienestarysaludmental@uft.cl' },
        to: [{ email: correo, name: nombre }],
        subject: 'Te esperamos — Bienestar Estudiantil UFT',
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
