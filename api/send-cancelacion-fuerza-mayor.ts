const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const CORREO_BIENESTAR = 'bienestaruft@gmail.com';
const URL_APP = 'https://vitejs-vite-ffxbb7jh.vercel.app/';

const PSICOLOGAS: Record<number, { nombre: string; correo: string }> = {
  1: { nombre: 'Francesca Figueroa', correo: 'ffigueroa@uft.cl' },
  2: { nombre: 'Trinidad Montes', correo: 'tmontes@uft.cl' },
  3: { nombre: 'Andrea García', correo: 'andreagarcia@uft.cl' },
  4: { nombre: 'Antonia Escalona', correo: 'antoniaescalona95@gmail.com' },
};

function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split('-');
  const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return `${dias[dt.getDay()]} ${d} de ${meses[Number(m) - 1]}`;
}

async function enviarCorreo(to: string, toName: string, subject: string, html: string) {
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Bienestar y Salud Mental UFT', email: 'bienestaruft@gmail.com' },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    }),
  });
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => '');
    throw new Error(`Brevo respondió ${resp.status}: ${detalle}`);
  }
  return resp;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nombre, correo, psicologaId, fechaRaw, horaRaw } = req.body;
  if (!nombre || !correo || !psicologaId || !fechaRaw || !horaRaw) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  const psiData = PSICOLOGAS[psicologaId];
  const psiNombre = psiData?.nombre || 'tu psicóloga';
  const fechaFormateada = formatFecha(fechaRaw);
  const motivoTexto = 'motivos de fuerza mayor';

  const html = `
    <div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f8f6ff;border-radius:16px;">
      <h2 style="color:#3d2f7a;font-size:17px;margin-bottom:16px;">Tu hora fue reprogramada</h2>
      <p style="color:#1a1040;font-size:14px;line-height:1.6;">Hola ${nombre},</p>
      <p style="color:#1a1040;font-size:14px;line-height:1.6;">
        Por ${motivoTexto}, tu hora con <strong>${psiNombre}</strong> agendada para el
        <strong>${fechaFormateada} a las ${horaRaw}</strong> fue cancelada.
      </p>
      <p style="color:#1a1040;font-size:14px;line-height:1.6;">
        Lamentamos el inconveniente. Te invitamos a agendar una nueva hora cuando quieras:
      </p>
      <a href="${URL_APP}" style="display:block;text-align:center;padding:12px;background:#3d2f7a;border-radius:10px;font-weight:700;font-size:14px;color:white;text-decoration:none;margin:16px 0;">📅 Reagendar mi hora</a>
      <p style="color:#7b6fa0;font-size:13px;line-height:1.6;">
        Si tienes dudas o es urgente, puedes escribirnos directamente a ${CORREO_BIENESTAR}.
      </p>
      <p style="color:#a89ec0;font-size:12px;margin-top:24px;text-align:center;">Bienestar y Salud Mental UFT</p>
    </div>
  `;

  if (!BREVO_API_KEY) {
    return res.status(500).json({ error: 'BREVO_API_KEY no está configurada en Vercel' });
  }

  try {
    await enviarCorreo(correo, nombre, `Tu hora del ${fechaFormateada} fue reprogramada — Bienestar UFT`, html);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error enviando correo' });
  }

  return res.status(200).json({ ok: true });
}
