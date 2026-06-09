import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { endpoint } = body;

  if (!endpoint || typeof endpoint !== 'string') {
    return NextResponse.json({ error: 'Ungültiger endpoint' }, { status: 400 });
  }

  const supabase = createServerClient();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);

  return NextResponse.json({ ok: true });
}
