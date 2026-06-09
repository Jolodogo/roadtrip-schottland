import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { passcode, title, text, location_name } = body;

  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: 'Ungültiger Passcode' }, { status: 401 });
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Titel darf nicht leer sein' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('posts')
    .update({
      title: title.trim(),
      text: text?.trim() || null,
      location_name: location_name?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
