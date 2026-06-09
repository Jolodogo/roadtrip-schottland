# Push-Benachrichtigungen — Design Spec
**Datum:** 2026-06-09  
**Feature:** Web Push API für PWA-Nutzer bei neuem Post  
**Kosten:** 100% kostenlos (Web Push API Standard, kein Drittanbieter)

---

## Ziel
Alle Besucher (Familie/Freunde) können Push-Benachrichtigungen abonnieren. Bei jedem neuen Post erhalten sie eine Browser-Notification — auch wenn die App geschlossen ist.

---

## Architektur

```
[Besucher] → Glocke-Button → Notification.requestPermission()
          → pushManager.subscribe() → POST /api/push/subscribe
          → Supabase: push_subscriptions

[Poster]   → POST /api/posts (201 OK)
          → Client: fetch('/api/push/notify') [fire-and-forget]
          → /api/push/notify holt alle Subscriptions
          → web-push.sendNotification() an alle
          → Service Worker: push-Event → showNotification()
          → Nutzer sieht Notification, Klick öffnet App
```

---

## Komponenten

### 1. VAPID-Keys (einmalig, manuell)
```bash
npx web-push generate-vapid-keys
```
→ in `.env.local` und Vercel Environment Variables:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:noreply@roadtrip-schottland.vercel.app
```

### 2. Supabase-Tabelle `push_subscriptions`
```sql
CREATE TABLE push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- Kein öffentlicher Zugriff — Service Role bypasses RLS automatisch
```

### 3. API Routes
**`POST /api/push/subscribe`**
- Body: `{ endpoint, keys: { p256dh, auth } }`
- Upsert in `push_subscriptions` (ON CONFLICT endpoint DO NOTHING)
- Kein Auth nötig (subscription enthält keine sensitiven Daten)

**`POST /api/push/notify`**
- Wird vom Client nach Post-Erstellung aufgerufen (fire-and-forget)
- Holt alle Subscriptions aus DB
- `webpush.sendNotification()` für jede Subscription
- Fehlgeschlagene Subscriptions (410 Gone) → aus DB löschen

### 4. Custom Service Worker (`worker/index.ts`)
next-pwa v10 merged eigene Worker-Dateien automatisch.
```typescript
// push-Event: Notification anzeigen
self.addEventListener('push', (event) => { ... showNotification(...) });
// notificationclick: App öffnen/fokussieren
self.addEventListener('notificationclick', (event) => { ... clients.openWindow('/') });
```

### 5. Subscribe-Button (`app/page.tsx`)
Glocken-Icon im Header. States:
- `idle` — 🔔 klickbar, weiß/gedimmt
- `loading` — Spinner
- `subscribed` — 🔔 grün
- `denied` — nicht gezeigt (Browser-Permission verweigert)

### 6. Notify nach Post (`app/post/page.tsx`)
Nach erfolgreichem POST `/api/posts`:
```typescript
fetch('/api/push/notify', { method: 'POST' }).catch(() => {});
```

---

## Neue/geänderte Dateien
| Datei | Art |
|---|---|
| `worker/index.ts` | neu |
| `app/api/push/subscribe/route.ts` | neu |
| `app/api/push/notify/route.ts` | neu |
| `next.config.js` | `customWorkerSrc: 'worker'` hinzufügen |
| `app/page.tsx` | Subscribe-Button im Header |
| `app/post/page.tsx` | notify nach Post |
| `supabase-schema.sql` | push_subscriptions Tabelle |
| `.env.local` | VAPID-Keys (manuell) |

---

## Manuelle Schritte (vor Deployment)
1. `npx web-push generate-vapid-keys` ausführen
2. Keys in `.env.local` eintragen
3. Keys in Vercel Environment Variables eintragen
4. SQL für `push_subscriptions` in Supabase SQL Editor ausführen

---

## Kosten-Check
| Dienst | Kosten |
|---|---|
| Web Push API | kostenlos (Browser-Standard) |
| `web-push` npm | OSS, kostenlos |
| Supabase `push_subscriptions` | ~1 KB pro Subscriber, free tier: 500 MB |
| Vercel `/api/push/notify` | serverless, ~1-2x/Tag, free tier: 100k/Monat |
