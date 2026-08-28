import { createClient } from '@supabase/supabase-js';

// Corre mensualmente (ver vercel.json). Anonimiza el nombre/RUT/correo/carrera
// de reservas cuya fecha de sesión ya pasó hace más de 1 año, dejando la fila
// (fecha, hora, psicóloga, estado) para estadísticas — sin datos identificables.
const RETENCION_DIAS = 365;

const supabase = createClient(
  'https://rumestjktglrodfoatre.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: any, res: any) {
  // Vercel Cron llama con GET; permitir también POST para pruebas manuales.
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limite = new Date();
  limite.setDate(limite.getDate() - RETENCION_DIAS);
  const limiteStr = limite.toISOString().slice(0, 10); // YYYY-MM-DD

  const { data: aAnonimizar, error: errBusqueda } = await supabase
    .from('slots')
    .select('id')
    .lt('fecha', limiteStr)
    .not('nombre_estudiante', 'is', null);

  if (errBusqueda) return res.status(500).json({ error: errBusqueda.message });
  if (!aAnonimizar || aAnonimizar.length === 0) {
    return res.status(200).json({ ok: true, anonimizados: 0 });
  }

  const { error: errUpdate } = await supabase
    .from('slots')
    .update({
      nombre_estudiante: null, rut_estudiante: null,
      correo_estudiante: null, carrera: null,
      reserva_nombre: null, reserva_rut: null, reserva_correo: null, reserva_carrera: null,
    })
    .in('id', aAnonimizar.map((s: { id: string }) => s.id));

  if (errUpdate) return res.status(500).json({ error: errUpdate.message });

  return res.status(200).json({ ok: true, anonimizados: aAnonimizar.length });
}
