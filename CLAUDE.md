# Roadtrip Schottland – Projektkontext für Claude Code

## Was ist das hier
Next.js 15 Web-App: Live-Tracking für einen Schottland-Roadtrip.
Öffentliche Karte mit Echtzeit-Markern, mobiles Post-Formular (Foto + GPS).

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Leaflet · Supabase

**Live:** https://roadtrip-schottland.vercel.app  
**GitHub:** https://github.com/Jolodogo/roadtrip-schottland  
**Supabase-Projekt:** usitibimgaedtgrscsvf (Central EU / Frankfurt)

---

## Setup beim Start einer neuen Session

```bash
# .env.local prüfen
ls -la .env.local
# Falls nicht vorhanden: cp .env.local.example .env.local → Keys eintragen

# Dependencies
npm install

# Dev-Server starten (läuft auf Port 3000)
npm run dev
```

**WICHTIG: `.env.local` niemals lesen, ausgeben oder committen.**

### Deploy nach Änderungen
```bash
git add -A
git commit -m "..."
git push
# Vercel deployt automatisch aus main
```

---

## Aktueller Stand (nach Session vom 09.06.2026)

### ✅ Erledigt
- App deployed auf Vercel (kostenlos, Hobby Plan)
- Supabase DB-Schema ausgeführt, Realtime für `posts` aktiv
- Kartenstil: CartoDB Light
- OSRM Straßenroute zwischen Posts (gestrichelt, grün)
- Reisestats in Sidebar: Strecke, Reisetage, Stopps, Strecke/Tag (mit km-Einheit)
- Wetter-Widget via Open-Meteo (kostenlos, kein API-Key) — Standort via Nominatim reverse geocoding
- Mobile Bottom Sheet: eingeklappt (zeigt "Updates" + KPIs), hochziehen zeigt alles
- Posts löschen: Passcode-Inline-Eingabe, funktioniert mobil + Desktop
- Posts bearbeiten: Stift-Icon auf PostCard, Passcode-geschützt, Felder: Titel, Text, Location
- PWA: App-Icon PNG 180×180 (Hund auf Saltire), Titel "Schottland-Roadtrip"
- Map-Bug behoben (StrictMode Doppelinitialisierung)
- Bottom Sheet z-index Fix (Leaflet-Isolation via z-0 + isolate)
- Passcode-Validierung: sofortige Server-Prüfung vor Formular-Zugang (`/api/auth`)
- Kommentare: PostCard aufklappbar, Name erforderlich, Name wird in localStorage gemerkt
- Kommentare: Supabase-Tabelle `comments` (post_id, author_name, text)
- Kommentare: Map-Popup zeigt Anzahl + öffnet Bottom Sheet beim Klick
- Herz-Reaktionen: Like-Button auf PostCard, localStorage-Sperre gegen Doppelklick
- Herz-Reaktionen: Supabase-Tabelle `reactions` (post_id)
- Herz-Reaktionen: Map-Popup zeigt Anzahl + scrollt zu PostCard beim Klick
- Lightbox: Bilder in PostCard + Map-Popup vollflächig öffnen (Portal-basiert)
- PDF-Anleitung: `Anleitung-HomeScreen.pdf` für iPhone + Android
- Icon-Modernisierung: `lucide-react` (strokeWidth 1.5) — Bell, BellOff, Heart, MessageCircle, Trash2, Pencil, MapPin, Plus, Loader2
- Map-Popup: Herz + Kommentar-Emoji durch inline SVG ersetzt (konsistent mit Lucide)

### ✅ Code-Review + Fixes (Session 09.06.2026)
- **Sicherheit:** Rate Limiting für `/api/auth` (10/15min) und `/api/reactions` (30/Stunde) via `lib/rateLimit.ts`
- **Sicherheit:** Magic Bytes Validierung für Datei-Uploads (JPEG/PNG/WebP/HEIC)
- **Sicherheit:** Koordinaten-Validierung in `/api/posts` POST
- **Sicherheit:** `escapeHtml()` für alle User-Inhalte in Leaflet-Popups; onclick-Args via `data-*` Attribute + `this.dataset` (NICHT JSON.stringify — doppelte Anführungszeichen brechen HTML-Attribute)
- **Performance:** Map-Marker-Flicker behoben — Refs für Counts, getrennte Effects (Marker nur bei Post-Änderungen, Counts inline)
- **Performance:** OSRM via `Promise.all()` statt sequentiell
- **Performance:** Wetter-Effect dep auf `posts[0]?.id` (kein Over-Fetching)
- **UX:** Offline-Banner (`isOffline` State + online/offline Events)
- **Env-Validierung:** `lib/supabase.ts` wirft Fehler wenn Keys fehlen
- **Bug:** `loadComments` useCallback-Deklaration vor autoOpenComments-Effect

### ✅ Offline-Caching via next-pwa (Session 09.06.2026)
- `@ducanh2912/next-pwa` installiert und in `next.config.js` konfiguriert
- `customWorkerSrc: 'worker'` — Custom Service Worker in `worker/index.ts`
- Workbox RuntimeCaching: CartoDB-Tiles (CacheFirst 30 Tage), Supabase-Fotos (CacheFirst 7 Tage), `/api/posts` (StaleWhileRevalidate)
- `.gitignore` um generierte SW-Dateien erweitert

### ✅ Bildkomprimierung (Session 09.06.2026)
- `browser-image-compression` installiert
- `handleImageChange` async: Vorschau sofort, Komprimierung im Web Worker (max. 1200px, 85% Qualität, max 2 MB)
- HEIC → JPEG automatisch
- Komprimierungs-Badge + Submit-Button disabled während Komprimierung

### ✅ Push-Benachrichtigungen (Session 09.06.2026)
- `web-push` npm-Paket installiert
- VAPID Keys generiert + in `.env.local` und Vercel eingetragen
- Supabase-Tabelle `push_subscriptions` angelegt (endpoint, p256dh, auth)
- `worker/index.ts`: Custom Service Worker — push-Event zeigt Notification, notificationclick öffnet App
- `app/api/push/subscribe/route.ts`: Browser-Subscription speichern (upsert on conflict endpoint)
- `app/api/push/notify/route.ts`: Push an alle Subscriber senden, 410-Gone automatisch löschen
- `app/page.tsx`: Bell-Icon im Header, Abo-Toggle, Berechtigungsabfrage
- `app/api/push/unsubscribe/route.ts`: Subscription per endpoint löschen
- `app/post/page.tsx`: Nach erfolgreichem Post → fire-and-forget notify
- Bell-Icon togglet: einmal = aktivieren, nochmal = deaktivieren
- iOS: funktioniert nur wenn PWA auf Homescreen installiert (iOS 16.4+)
- "from Schottland" in Push-Nachricht: browser-enforced, nicht entfernbar

### ✅ UX-Fixes (Session 09.06.2026)
- Hydration-Error behoben: `typeof window !== 'undefined'` im JSX → `mounted`-State (useEffect)
- KPI collapsed Bottom Sheet: Labels `text-[8px]` → `text-[10px]`, Werte `text-[11px]` → `text-xs`
- KPI expanded Sidebar: Labels `text-[11px]` → `text-xs`, Werte `text-base` → `text-lg`
- Reisetage: Einheit "Tage" hinter Wert entfernt
- Map-Popup Kommentar-Button: `white-space:nowrap` verhindert Zeilenumbruch bei zweistelligen Zahlen
- Map-Popup onclick-Callbacks: `JSON.stringify` → `data-*` Attribute + `this.dataset` (Bug-Fix)
- Anleitung: `public/anleitung.html` — erreichbar unter `/anleitung.html`, druckbar als PDF

### ✅ Mehrere Bilder pro Post (Session 09.06.2026)
- Supabase: `image_urls TEXT[] DEFAULT '{}'` Spalte in `posts` (SQL ausgeführt)
- Upload: max. 5 Bilder, Komprimierung parallel, Thumbnail-Grid im Formular
- API: `image_urls` Array + `image_url` (erstes Bild, Rückwärtskompatibilität)
- PostCard: Karussell mit ‹ › Prev/Next + Punkt-Indikatoren, Lightbox für jedes Bild
- Bestehende Posts: zeigen weiterhin ihr einzelnes Bild (image_url)

### 🔲 Keine offenen Aufgaben

---

## Projektstruktur

```
app/
  page.tsx              # Hauptseite: Karte + Sidebar (Desktop) + Bottom Sheet (Mobile)
  post/page.tsx         # Mobiles Post-Formular (Passcode-geschützt)
  api/posts/route.ts    # GET / POST / DELETE Posts (DELETE prüft Passcode + löscht Bild)
  api/posts/[id]/route.ts # PATCH Post bearbeiten (prüft Passcode, aktualisiert title/text/location_name)
  api/push/subscribe/route.ts # POST Browser-PushSubscription speichern
  api/push/notify/route.ts    # POST Push an alle Subscriber senden
  api/upload/route.ts   # Foto-Upload zu Supabase Storage (bucket: trip-photos)
  api/comments/route.ts # GET (alle oder nach post_id) / POST neue Kommentare
  api/reactions/route.ts# GET (Counts alle Posts) / POST neues Like
  api/auth/route.ts     # POST Passcode-Validierung (server-seitig)
  globals.css           # Leaflet-Styles, Attribution-Styling, Popup-Styles
  layout.tsx            # Metadata, PWA-Config, Manifest-Referenz
components/
  Map.tsx               # Leaflet-Karte (dynamic/ssr:false), Marker, OSRM-Route, Popups
lib/
  supabase.ts           # Browser- und Server-Client
  types.ts              # Post, Comment Interfaces
public/
  manifest.json         # PWA Manifest
  icon.png              # App-Icon 180×180px (Hund auf Saltire, abgerundete Ecken)
  logo.png              # Header-Logo 40×40px
  dog-source.png        # Originalquelle für Icon-Generierung (nicht deployed relevant)
  Anleitung-HomeScreen.pdf  # Nutzer-Anleitung PWA Installation
worker/
  index.ts              # Custom Service Worker: push-Event + notificationclick
supabase-schema.sql     # SQL für alle Tabellen (posts, comments, reactions, push_subscriptions)
```

---

## Supabase-Tabellen
| Tabelle | Felder | Besonderheit |
|---|---|---|
| `posts` | id, created_at, title, text, latitude, longitude, image_url, location_name, day_number | Realtime aktiv |
| `comments` | id, created_at, post_id, author_name, text | RLS: SELECT public |
| `reactions` | id, created_at, post_id | RLS: SELECT public |
| `push_subscriptions` | id, endpoint, p256dh, auth, created_at | RLS aktiviert, kein public SELECT |

---

## Wichtige Regeln für Code-Änderungen

- Kommentare auf Deutsch
- Nur anfassen was geändert werden muss
- `.env.local` niemals lesen, ausgeben oder committen
- Leaflet muss immer per `dynamic()` mit `ssr: false` geladen werden
- Passcode-Verifikation liegt ausschließlich in den API Routes (server-seitig)
- Lightboxen via `createPortal(…, document.body)` — nicht als Kind von transformierten Elementen
- Map-Callbacks (Like, Kommentar, Bild) über `window.__map*`-Globals (Leaflet HTML → React)
- Icons: `lucide-react` mit `strokeWidth={1.5}`, w-4/w-5 — keine Emojis für UI-Aktionen
- Leaflet-Popup kann keine React-Komponenten nutzen → inline SVG HTML-Strings verwenden
- Leaflet-Popup onclick: NIEMALS `JSON.stringify` für Strings verwenden → doppelte Anführungszeichen brechen `onclick="..."` Attribute → stattdessen `data-*` Attribute + `this.dataset`
- `typeof window !== 'undefined'` NICHT direkt im JSX verwenden → Hydration-Error → stattdessen `mounted`-State mit `useEffect`
- `worker/` ist aus `tsconfig.json` exclude — next-pwa kompiliert es separat
- Nach Änderungen Build-Check: `npm run build`
- Vor Commit prüfen ob `.env.local` NICHT in `git status` auftaucht

---

## Kosten (alles kostenlos)
| Dienst | Plan | Limit |
|---|---|---|
| Vercel | Hobby (free) | 100GB Bandwidth/Monat |
| Supabase | Free | 500MB DB, 1GB Storage |
| Open-Meteo | Free | unbegrenzt |
| OSRM | Free public server | unbegrenzt |
| CartoDB Tiles | Free | unbegrenzt |
| Nominatim | Free | unbegrenzt (fair use) |

---

## Supabase – manuelle Schritte (bereits erledigt)
1. ✅ Projekt angelegt: usitibimgaedtgrscsvf
2. ✅ `supabase-schema.sql` im SQL Editor ausgeführt (posts + comments + reactions)
3. ✅ Realtime aktiviert: Database → Publications → supabase_realtime → posts
4. ✅ API-Keys in `.env.local` und Vercel Environment Variables eingetragen

---

## Passcode
`UK2026` — zum Posten, Löschen und Bearbeiten (nur in `.env.local` / Vercel gespeichert, nie im Code)

## VAPID-Keys (Push Notifications)
- Public Key: `BG1BbRbOApWy9ZbjZiT4VEO66W3l4nh5i2FD33NsFsV-BaCCtaLqQtrUNU9VU10xtdPvL_KgPK0nz7zA52mBPaA`
- Private Key: nur in `.env.local` und Vercel — NIEMALS im Code
- Subject: `mailto:cordes.john@web.de`
