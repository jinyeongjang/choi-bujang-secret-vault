import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return response.status(500).json({ error: 'DATABASE_CONFIG_MISSING' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from('notes')
      .select('title, content')
      .order('created_at', { ascending: true });

    if (error) {
      return response.status(500).json({ error: 'DATABASE_QUERY_FAILED' });
    }

    return response.status(200).json({
      sampleMarker: 'SAMPLE_NOTE_1',
      notes: data ?? [],
    });
  } catch (_error) {
    // 키나 내부 스택을 로그 및 응답에 노출하지 않습니다.
    return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}
