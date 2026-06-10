import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { isRateLimited, getClientIp } from '@/lib/rateLimit';

// GET /api/comment-reactions?comment_ids=id1,id2,...
// Gibt {[comment_id]: count} zurück
export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('comment_ids')?.split(',').filter(Boolean) ?? [];
  if (ids.length === 0) return NextResponse.json({});

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('comment_reactions')
    .select('comment_id')
    .in('comment_id', ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};
  data?.forEach((r) => { counts[r.comment_id] = (counts[r.comment_id] || 0) + 1; });
  return NextResponse.json(counts);
}

export async function POST(request: NextRequest) {
  // Max 30 Likes pro IP pro Stunde
  const ip = getClientIp(request);
  if (isRateLimited(`comment_reactions:${ip}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Zu viele Likes. Bitte warten.' }, { status: 429 });
  }

  const { comment_id } = await request.json();
  if (!comment_id) return NextResponse.json({ error: 'comment_id fehlt' }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase.from('comment_reactions').insert([{ comment_id }]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
