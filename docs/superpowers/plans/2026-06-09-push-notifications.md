# Push-Benachrichtigungen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Besucher können Push-Benachrichtigungen abonnieren — bei neuem Post kommt eine Browser-Notification, auch wenn die App geschlossen ist.

**Architecture:** Web Push API mit VAPID-Keys (kein Drittanbieter). Subscriptions in Supabase `push_subscriptions`. Custom Service Worker via `@ducanh2912/next-pwa` `customWorkerSrc`. Notify-Route wird nach Post-Erstellung fire-and-forget aufgerufen.

**Tech Stack:** `web-push` npm, Web Push API (Browser-Standard), Supabase Service Role, `@ducanh2912/next-pwa` Custom Worker, Next.js 15 App Router API Routes

---

### Manuelle Voraussetzungen (BEVOR Code ausgeführt wird)

Diese Schritte muss der Nutzer **einmalig manuell** durchführen:

**1. VAPID-Keys generieren:**
```bash
cd "/Users/johncordes/Desktop/Claude/Roadtrip Schottland"
npx web-push generate-vapid-keys
```
Ausgabe notieren — zwei Keys werden angezeigt (Public + Private).

**2. Keys in `.env.local` eintragen:**
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<Public Key aus Schritt 1>
VAPID_PRIVATE_KEY=<Private Key aus Schritt 1>
VAPID_SUBJECT=mailto:altrichter.velly@gmx.de
```

**3. Dieselben Keys in Vercel eintragen:**
Vercel Dashboard → Projekt → Settings → Environment Variables → alle 3 hinzufügen.

**4. Supabase: `push_subscriptions` Tabelle anlegen:**
Supabase Dashboard → SQL Editor → ausführen:
```sql
CREATE TABLE push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- Service Role bypasses RLS automatisch — kein öffentlicher Zugriff
```

---

### Task 1: `web-push` installieren

**Files:**
- Modify: `package.json` (automatisch via npm)

- [ ] **Step 1: Installieren**

```bash
cd "/Users/johncordes/Desktop/Claude/Roadtrip Schottland"
npm install web-push
npm install --save-dev @types/web-push
```

Erwartete Ausgabe: `added X packages` ohne Fehler.

- [ ] **Step 2: Prüfen**

```bash
grep "web-push" "/Users/johncordes/Desktop/Claude/Roadtrip Schottland/package.json"
```

Erwartete Ausgabe: `"web-push": "^3.x.x"` in dependencies.

---

### Task 2: Custom Service Worker für Push-Events

**Files:**
- Create: `worker/index.ts`

Der Custom Worker wird von `@ducanh2912/next-pwa` automatisch mit dem generierten Service Worker zusammengeführt.

- [ ] **Step 1: Verzeichnis erstellen und Worker schreiben**

Datei erstellen: `worker/index.ts`

```typescript
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// Push-Notification empfangen und anzeigen
self.addEventListener('push', (event) => {
  const data = event.data?.json() as {
    title?: string;
    body?: string;
    url?: string;
    icon?: string;
  } ?? {};

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Schottland-Roadtrip 🏴󠁧󠁢󠁳󠁣󠁴󠁿', {
      body: data.body ?? 'Neuer Post veröffentlicht!',
      icon: data.icon ?? '/icon.png',
      badge: '/icon.png',
      data: { url: data.url ?? '/' },
    })
  );
});

// Auf Notification-Klick: App öffnen oder fokussieren
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data as { url?: string })?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Falls Tab schon offen: fokussieren
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      // Sonst neues Tab öffnen
      return self.clients.openWindow(targetUrl);
    })
  );
});
```

- [ ] **Step 2: Worker-Verzeichnis in tsconfig prüfen**

```bash
grep -n "worker\|include\|exclude" "/Users/johncordes/Desktop/Claude/Roadtrip Schottland/tsconfig.json"
```

Falls `worker/` nicht in `include` liegt: kein Problem, next-pwa kompiliert es separat. Keine tsconfig-Änderung nötig.

---

### Task 3: `next.config.js` — `customWorkerSrc` hinzufügen

**Files:**
- Modify: `next.config.js`

- [ ] **Step 1: `customWorkerSrc` Option hinzufügen**

In `next.config.js`, die `withPWA({...})` Konfiguration erweitern:

```javascript
// vorher:
module.exports = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: { ... }
})(nextConfig);

// nachher — eine Zeile hinzufügen:
module.exports = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  customWorkerSrc: 'worker',
  workboxOptions: { ... }
})(nextConfig);
```

Nur `customWorkerSrc: 'worker',` nach `reloadOnOnline: true,` einfügen.

---

### Task 4: API Route `/api/push/subscribe`

**Files:**
- Create: `app/api/push/subscribe/route.ts`

Speichert eine Browser-PushSubscription in Supabase. Kein Auth nötig — eine Subscription hat keinen Zugriff auf App-Daten.

- [ ] **Step 1: Route anlegen**

Datei erstellen: `app/api/push/subscribe/route.ts`

```typescript
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
```

---

### Task 5: API Route `/api/push/notify`

**Files:**
- Create: `app/api/push/notify/route.ts`

Holt alle Subscriptions und sendet eine Push-Notification. Wird vom Client fire-and-forget aufgerufen nach Post-Erstellung.

- [ ] **Step 1: Route anlegen**

Datei erstellen: `app/api/push/notify/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createServerClient } from '@/lib/supabase';

// VAPID einmalig konfigurieren
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

  // Optionaler Payload (Titel, Body, URL)
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

  // Subscriptions zum Löschen sammeln (abgelaufen / 410 Gone)
  const toDelete: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notifData
        );
      } catch (err: any) {
        // 410 Gone = Browser hat Subscription widerrufen → löschen
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          toDelete.push(sub.endpoint);
        } else {
          console.error('webpush.sendNotification:', err);
        }
      }
    })
  );

  // Abgelaufene Subscriptions aufräumen
  if (toDelete.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', toDelete);
  }

  return NextResponse.json({ sent: subscriptions.length - toDelete.length });
}
```

---

### Task 6: Subscribe-Button in `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

Glocken-Icon im Header. Klick löst Permission-Anfrage + Subscription aus.

- [ ] **Step 1: Helper-Funktion `urlBase64ToUint8Array` am Dateianfang hinzufügen**

Direkt nach den bestehenden Imports (nach `import { Post, Comment } from '@/lib/types';`), vor der `haversineKm`-Funktion einfügen:

```typescript
// Konvertiert VAPID Public Key vom Base64-Format in Uint8Array für pushManager.subscribe()
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
```

- [ ] **Step 2: `pushState` State nach `isOffline` State einfügen**

```typescript
// vorher (Zeile ~436):
const [isOffline, setIsOffline] = useState(false);

// nachher:
const [isOffline, setIsOffline] = useState(false);
const [pushState, setPushState] = useState<'idle' | 'loading' | 'subscribed' | 'denied'>('idle');
```

- [ ] **Step 3: Push-Initialisierungs-Effect hinzufügen**

Nach dem `isOffline`-Effect (dem Block mit `window.addEventListener('offline', ...)`) einfügen:

```typescript
// Initialen Push-Status ermitteln
useEffect(() => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'denied') {
    setPushState('denied');
  } else if (Notification.permission === 'granted') {
    // Prüfen ob aktive Subscription vorhanden
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription()
    ).then((sub) => {
      if (sub) setPushState('subscribed');
    }).catch(() => {});
  }
}, []);
```

- [ ] **Step 4: `handlePushSubscribe` Funktion hinzufügen**

Direkt nach dem Push-Initialisierungs-Effect:

```typescript
const handlePushSubscribe = useCallback(async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  setPushState('loading');

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setPushState('denied');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      ),
    });

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });

    setPushState('subscribed');
  } catch (err) {
    console.error('Push-Subscription fehlgeschlagen:', err);
    setPushState('idle');
  }
}, []);
```

- [ ] **Step 5: Glocken-Button im Header einfügen**

Im Header-Bereich, innerhalb von `<div className="flex items-center gap-2">` (direkt vor dem `+ Post` Link):

```tsx
{/* Push-Notification Glocke — nur anzeigen wenn Browser es unterstützt und nicht verweigert */}
{typeof window !== 'undefined' && 'Notification' in window && pushState !== 'denied' && (
  <button
    onClick={handlePushSubscribe}
    disabled={pushState === 'loading' || pushState === 'subscribed'}
    title={pushState === 'subscribed' ? 'Benachrichtigungen aktiv' : 'Benachrichtigungen aktivieren'}
    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
      pushState === 'subscribed'
        ? 'text-green-400'
        : 'text-white/40 hover:text-white/70 hover:bg-green-900/30'
    }`}
  >
    {pushState === 'loading' ? (
      <span className="animate-spin text-xs">⏳</span>
    ) : pushState === 'subscribed' ? (
      '🔔'
    ) : (
      '🔕'
    )}
  </button>
)}
```

---

### Task 7: Notify nach Post in `app/post/page.tsx`

**Files:**
- Modify: `app/post/page.tsx`

Nach erfolgreichem Post fire-and-forget Notify-Call.

- [ ] **Step 1: Notify-Call nach `setSubmitted(true)` einfügen**

In der `handleSubmit` Funktion, direkt nach `setSubmitted(true);` (Zeile ~154):

```typescript
// vorher:
setSubmitted(true);

// nachher:
setSubmitted(true);
// Push-Notification an alle Abonnenten senden (fire-and-forget)
fetch('/api/push/notify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Neuer Post auf der Karte! 🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    body: title.trim(),
    url: '/',
  }),
}).catch(() => {});
```

---

### Task 8: `supabase-schema.sql` aktualisieren

**Files:**
- Modify: `supabase-schema.sql`

- [ ] **Step 1: push_subscriptions Tabelle dokumentieren**

Am Ende der Datei anfügen:

```sql
-- ============================================================
-- NEU: Push-Subscriptions (manuell im SQL Editor ausführen)
-- ============================================================

CREATE TABLE push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- Service Role bypasses RLS automatisch — kein öffentlicher Zugriff
```

---

### Task 9: `.env.local.example` anlegen

**Files:**
- Create: `.env.local.example`

- [ ] **Step 1: Beispieldatei erstellen**

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Passcode (zum Posten und Löschen)
ADMIN_PASSCODE=UK2026

# Push-Benachrichtigungen (VAPID)
# Keys generieren: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:altrichter.velly@gmx.de
```

---

### Task 10: Build + Commit

**Files:** keine neuen

- [ ] **Step 1: Build prüfen**

```bash
cd "/Users/johncordes/Desktop/Claude/Roadtrip Schottland"
npm run build 2>&1
```

Erwartete Ausgabe: Build grün, keine TypeScript-Fehler. Falls Fehler bei `web-push` Types → prüfen ob `@types/web-push` installiert.

- [ ] **Step 2: .env.local NICHT in git status**

```bash
cd "/Users/johncordes/Desktop/Claude/Roadtrip Schottland"
git status
```

`.env.local` darf NICHT unter "Changes" oder "Untracked" erscheinen.

- [ ] **Step 3: Commit**

```bash
cd "/Users/johncordes/Desktop/Claude/Roadtrip Schottland"
git add \
  worker/index.ts \
  app/api/push/subscribe/route.ts \
  app/api/push/notify/route.ts \
  next.config.js \
  app/page.tsx \
  app/post/page.tsx \
  supabase-schema.sql \
  .env.local.example \
  package.json \
  package-lock.json \
  docs/superpowers/specs/2026-06-09-push-notifications-design.md \
  docs/superpowers/plans/2026-06-09-push-notifications.md \
  CLAUDE.md
git commit -m "feat: Push-Benachrichtigungen via Web Push API

- VAPID-basierte Push-Notifications (kostenlos, kein Drittanbieter)
- Alle Besucher können Glocke im Header klicken → Browser-Permission
- Subscriptions in Supabase push_subscriptions Tabelle
- /api/push/subscribe: Subscription speichern
- /api/push/notify: nach jedem Post alle Abonnenten benachrichtigen
- Custom Service Worker: push + notificationclick Events
- Abgelaufene Subscriptions (410 Gone) werden automatisch gelöscht

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Verifikation nach Deployment

1. `npm run build` grün
2. In Browser: Glocke im Header klicken → Permission-Dialog erscheint
3. Erlauben → Glocke wird grün (🔔)
4. Neuen Post erstellen → Push-Notification empfangen
5. Notification klicken → App öffnet sich

**Hinweis für lokales Testen:** Service Worker funktioniert im Development nicht (deaktiviert via `disable: NODE_ENV === 'development'`). Test ausschließlich über Vercel-Deployment oder `npm run build && npx serve@latest out`.
