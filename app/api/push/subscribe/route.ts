import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }

  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'endpoint' }
    );

  if (error) {
    console.error('push_subscriptions upsert:', error);
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
