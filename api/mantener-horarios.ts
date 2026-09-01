import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rumestjktglrodfoatre.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const SEMANAS_VENTANA_FIJA = 4;

// Debe mantenerse igual a PLANTILLA_FIJA en src/App.tsx — si cambian los
// horarios de alguna psicóloga ahí, hay que replicar el cambio acá también.
const PLANTILLA_FIJA: Record<number, { dia: number; hora: string }[]> = {
  1: [ // Francesca Figueroa
    { dia: 1, hora: '11:00' }, { dia: 1, hora: '12:00' },
    { dia: 3, hora: '12:00' }, { dia: 3, hora: '13:00' },
    { dia: 4, hora: '11:00' }, { dia: 4, hora: '12:00' },
  ],
  2: [ // Trinidad Montes
    { dia: 1, hora: '12:00' }, { dia: 1, hora: '15:00' },
    { dia: 3, hora: '11:00' },
    { dia: 4, hora: '10:00' }, { dia: 4, hora: '13:00' },
    { dia: 5, hora: '10:00' },
  ],
  3: [ // Andrea García
    { dia: 1, hora: '15:00' },
    { dia: 2, hora: '10:00' }, { dia: 2, hora: '13:00' },
    { dia: 4, hora: '10:00' }, { dia: 4, hora: '12:00' },
    { dia: 5, hora: '10:00' }, { dia: 5, hora: '12:00' },
  ],
};

function fmtLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function generarVentanaFija(semanas = SEMANAS_VENTANA_FIJA) {
  const dias: { fecha: string; dow: number }[] = [];
  const hoy = new Date();
  const totalDias = semanas * 7;
  for (let i = 0; i <= totalDias; i++) {
    const f = new Date(hoy);
    f.setDate(hoy.getDate() + i);
    const dow = f.getDay();
    if (dow === 0 || dow === 6) continue;
    dias.push({ fecha: fmtLocal(f), dow });
  }
  return dias;
}

function horaEnRangoBloqueo(hora: string, desde?: string | null, hasta?: string | null) {
  if (!desde) return true;
  if (!hasta) return hora === desde;
  return hora >= desde && hora <= hasta;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY' });
  }

  const { data: bloqueos } = await supabase.from('dias_bloqueados').select('*');
  const { data: existentesData } = await supabase.from('slots').select('psicologa_id, fecha, hora');
  const existentes = new Set((existentesData || []).map((s: any) => `${s.psicologa_id}|${s.fecha}|${s.hora}`));

  const ventana = generarVentanaFija();
  const nuevos: any[] = [];

  for (const psiIdStr of Object.keys(PLANTILLA_FIJA)) {
    const psiId = Number(psiIdStr);
    for (const bloque of PLANTILLA_FIJA[psiId]) {
      for (const { fecha, dow } of ventana) {
        if (dow !== bloque.dia) continue;
        const bloqueado = (bloqueos || []).some((b: any) =>
          b.psicologa_id === psiId && fecha >= b.fecha_inicio && fecha <= b.fecha_fin &&
          horaEnRangoBloqueo(bloque.hora, b.hora, b.hora_hasta)
        );
        if (bloqueado) continue;
        const key = `${psiId}|${fecha}|${bloque.hora}`;
        if (existentes.has(key)) continue;
        existentes.add(key);
        nuevos.push({
          psicologa_id: psiId, fecha, hora: bloque.hora,
          disponible: true, realizada: false, reserva_tipo: 'fijo',
          nombre_estudiante: null, rut_estudiante: null, carrera: null, correo_estudiante: null,
        });
      }
    }
  }

  if (nuevos.length > 0) {
    await supabase.from('slots').upsert(nuevos, { onConflict: 'psicologa_id,fecha,hora', ignoreDuplicates: true });
  }

  // Limpia horarios vencidos y nunca reservados, dejando registro en bitácora.
  const hoy = fmtLocal(new Date());
  const { data: todos } = await supabase.from('slots').select('id, psicologa_id, fecha, hora, disponible, realizada, reserva_tipo');
  const vencidos = (todos || []).filter((s: any) => s.disponible && !s.realizada && s.fecha < hoy);
  if (vencidos.length > 0) {
    await supabase.from('slots_log').insert(vencidos.map((s: any) => ({
      slot_id: s.id, psicologa_id: s.psicologa_id, fecha: s.fecha,
      hora: s.hora, reserva_tipo: s.reserva_tipo, accion: 'no_agendada',
    })));
    await supabase.from('slots').delete().in('id', vencidos.map((s: any) => s.id));
  }

  return res.status(200).json({ ok: true, generados: nuevos.length, limpiados: vencidos.length });
}
