import { createClient } from '@supabase/supabase-js';

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(
  'https://rumestjktglrodfoatre.supabase.co',
  SERVICE_ROLE_KEY,
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor' });

  const { rut } = req.body || {};
  if (!rut || typeof rut !== 'string') return res.status(400).json({ error: 'RUT requerido' });

  const rutLimpio = rut.replace(/[.\-\s]/g, '').toUpperCase();
  const { data } = await supabaseAdmin
    .from('ruts_bloqueados')
    .select('rut')
    .eq('rut', rutLimpio)
    .eq('activo', true)
    .maybeSingle();

  // Solo responde sí/no — nunca el listado ni el motivo del bloqueo.
  return res.status(200).json({ bloqueado: !!data });
}
