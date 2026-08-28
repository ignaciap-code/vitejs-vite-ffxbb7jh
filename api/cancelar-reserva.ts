import { createClient } from '@supabase/supabase-js';

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

  const { id, rut } = req.body || {};
  if (!id || !rut) return res.status(400).json({ error: 'Faltan datos' });

  // Verifica que la hora exista, esté efectivamente reservada, y que el RUT
  // que pide la cancelación sea el mismo que la reservó — recién ahí cancela.
  const { data: slot, error: errBusqueda } = await supabaseAdmin
    .from('slots')
    .select('id, psicologa_id, fecha, hora, nombre_estudiante, rut_estudiante, correo_estudiante, disponible, realizada')
    .eq('id', id)
    .single();

  if (errBusqueda || !slot) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (slot.disponible || slot.realizada) return res.status(409).json({ error: 'Esta hora ya no está reservada' });
  if (!slot.rut_estudiante || limpiarRut(slot.rut_estudiante) !== limpiarRut(rut)) {
    return res.status(403).json({ error: 'El RUT no coincide con el de esta reserva' });
  }

  const { error: errUpdate } = await supabaseAdmin.from('slots').update({
    disponible: true, nombre_estudiante: null, rut_estudiante: null,
    carrera: null, correo_estudiante: null,
  }).eq('id', id);

  if (errUpdate) return res.status(500).json({ error: errUpdate.message });

  return res.status(200).json({
    ok: true,
    slot: { psicologa_id: slot.psicologa_id, fecha: slot.fecha, hora: slot.hora, nombre_estudiante: slot.nombre_estudiante, correo_estudiante: slot.correo_estudiante },
  });
}
