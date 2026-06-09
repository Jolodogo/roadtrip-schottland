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

  const { title, text, latitude, longitude, image_url, image_urls, location_name, day_number } = postData;

  if (!title || latitude === undefined || longitude === undefined) {
    return NextResponse.json({ error: 'Titel und Position sind erforderlich' }, { status: 400 });
  }
  if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
      isNaN(latitude) || isNaN(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'Ungültige Koordinaten' }, { status: 400 });
  }

  const supabase = createServerClient();

  // image_url = erstes Bild (Rückwärtskompatibilität), image_urls = alle Bilder
  const allImages = image_urls ?? (image_url ? [image_url] : []);
  const primaryImage = allImages[0] ?? image_url ?? null;

  const { data, error } = await supabase
    .from('posts')
    .insert([{ title, text, latitude, longitude, image_url: primaryImage, image_urls: allImages, location_name, day_number }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { id, passcode } = await request.json();

  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: 'Ungültiger Passcode' }, { status: 401 });
  }

  const supabase = createServerClient();

  // Alle Bilder aus Storage löschen
  const { data: post } = await supabase.from('posts').select('image_url, image_urls').eq('id', id).single();
  const allUrls = post?.image_urls?.length ? post.image_urls : (post?.image_url ? [post.image_url] : []);
  if (allUrls.length) {
    try {
      const paths = allUrls.map((u: string) => new URL(u).pathname.split('/trip-photos/')[1]).filter(Boolean);
      if (paths.length) {
        const { error: storageError } = await supabase.storage.from('trip-photos').remove(paths);
        if (storageError) console.error('Storage-Löschfehler:', storageError.message);
      }
    } catch (e) {
      console.error('Fehler beim Parsen der Bild-URLs:', e);
    }
  }

  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
