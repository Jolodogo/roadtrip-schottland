import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { CreatePostPayload } from '@/lib/types';

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body: CreatePostPayload = await request.json();
  const { passcode, ...postData } = body;

  // Verify passcode server-side
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: 'Ungültiger Passcode' }, { status: 401 });
  }

  const { title, text, latitude, longitude, image_url, location_name, day_number } = postData;

  if (!title || latitude === undefined || longitude === undefined) {
    return NextResponse.json({ error: 'Titel und Position sind erforderlich' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('posts')
    .insert([{ title, text, latitude, longitude, image_url, location_name, day_number }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
