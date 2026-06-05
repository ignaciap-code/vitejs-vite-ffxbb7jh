import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rumestjktglrodfoatre.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1bWVzdGprdGdscm9kZm9hdHJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDYxMDIsImV4cCI6MjA5NjE4MjEwMn0.FFnWHGSwgSCVIBfRsN7bG_BW1C5tuwOtSTGLaXslor4';

export const supabase = createClient(supabaseUrl, supabaseKey);
