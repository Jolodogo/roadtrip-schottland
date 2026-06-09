import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { isRateLimited, getClientIp } from '@/lib/rateLimit';

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase.from('reactions').select('post_id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const counts: Record<string, number> = {};
  data?.forEach((r) => { counts[r.post_id] = (counts[r.post_id] || 0) + 1; });
  return NextResponse.json(counts);
}

export async function POST(request: NextRequest) {
  // Max 30 Likes pro IP pro Stunde (verhindert Spam-Bots)
  const ip = getClientIp(request);
  if (isRateLimited(`reactions:${ip}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Zu viele Likes. Bitte warten.' }, { status: 429 });
  }

  const { post_id } = await request.json();
  if (!post_id) return NextResponse.json({ error: 'post_id fehlt' }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase.from('reactions').insert([{ post_id }]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
