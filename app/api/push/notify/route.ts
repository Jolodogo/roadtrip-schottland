import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createServerClient } from '@/lib/supabase';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export async function POST(request: NextRequest) {
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return NextResponse.json({ error: 'VAPID nicht konfiguriert' }, { status: 500 });
  }

  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = await request.json();
  } catch {
    // kein Body — Defaults verwenden
  }

  const notifData = JSON.stringify({
    title: payload.title ?? 'Schottland-Roadtrip 🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    body: payload.body ?? 'Neuer Post auf der Karte!',
    url: payload.url ?? '/',
    icon: '/icon.png',
  });

  const supabase = createServerClient();
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (error) {
    console.error('push_subscriptions select:', error);
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Abgelaufene Subscriptions sammeln
  const toDelete: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notifData
        );
      } catch (err: any) {
        // 410 Gone / 404 = Browser hat Subscription widerrufen → löschen
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          toDelete.push(sub.endpoint);
        } else {
          console.error('webpush.sendNotification:', err);
        }
      }
    })
  );

  if (toDelete.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', toDelete);
  }

  return NextResponse.json({ sent: subscriptions.length - toDelete.length });
}
