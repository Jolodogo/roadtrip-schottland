import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postId = searchParams.get('post_id');
  const supabase = createServerClient();

  // Ohne post_id: Anzahl aller Kommentare je Post zurückgeben
  if (!postId) {
    const { data, error } = await supabase.from('comments').select('post_id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const counts: Record<string, number> = {};
    data?.forEach((c) => { counts[c.post_id] = (counts[c.post_id] || 0) + 1; });
    return NextResponse.json(counts);
  }

  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { post_id, author_name, text } = await request.json();

  if (!post_id || !author_name?.trim() || !text?.trim()) {
    return NextResponse.json({ error: 'Name und Kommentar erforderlich' }, { status: 400 });
  }
  if (author_name.trim().length > 50) {
    return NextResponse.json({ error: 'Name max 50 Zeichen' }, { status: 400 });
  }
  if (text.trim().length > 500) {
    return NextResponse.json({ error: 'Kommentar max 500 Zeichen' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('comments')
    .insert([{ post_id, author_name: author_name.trim(), text: text.trim() }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
