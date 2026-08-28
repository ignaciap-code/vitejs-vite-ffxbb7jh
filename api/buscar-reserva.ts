import { createClient } from '@supabase/supabase-js';

// Esta clave (service_role) tiene acceso completo y bypassa RLS — por eso
// SOLO puede vivir acá, en una función serverless, nunca en el código del
// navegador. Se configura como variable de entorno en Vercel.
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(
  'https://rumestjktglrodfoatre.supabase.co',
  SERVICE_ROLE_KEY,
);

function limpiarRut(rut: string) {
  return rut.replace(/[.\-\s]/g, '').toUpperCase();
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor' });

  const { rut } = req.body || {};
  if (!rut || typeof rut !== 'string') return res.status(400).json({ error: 'RUT requerido' });

  const rutLimpio = limpiarRut(rut);

  // Trae solo reservas activas y compara el RUT ya normalizado — nunca se
  // devuelve el listado completo de la tabla, solo las filas del RUT pedido.
  const { data, error } = await supabaseAdmin
    .from('slots')
    .select('id, psicologa_id, fecha, hora, nombre_estudiante, rut_estudiante, correo_estudiante, disponible, realizada')
    .eq('disponible', false)
    .eq('realizada', false);

  if (error) return res.status(500).json({ error: error.message });

  const misReservas = (data || []).filter(
    (s: { rut_estudiante: string | null }) => s.rut_estudiante && limpiarRut(s.rut_estudiante) === rutLimpio
  );

  return res.status(200).json({ reservas: misReservas });
}
