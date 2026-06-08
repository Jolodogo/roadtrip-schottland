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
- Reisestats in Sidebar: Strecke, Reisetage, Stopps, km/Tag
- Wetter-Widget via Open-Meteo (kostenlos, kein API-Key) — Standort via Nominatim reverse geocoding
- Mobile Bottom Sheet: eingeklappt (zeigt "Updates" + KPIs), hochziehen zeigt alles
- Posts löschen: 🗑️ Icon auf PostCard, Passcode-Inline-Eingabe, funktioniert mobil + Desktop
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

### 🔲 Nächste Session — geplante Verbesserungen
- **Offline-Caching (PWA Service Worker)** via `next-pwa` — Karte bleibt bei schlechtem Netz nutzbar
- **Bildkomprimierung beim Upload** — Canvas-Resize auf max. 1200px vor dem Upload, spart Storage + Ladezeit
- **Push-Benachrichtigungen** — Nutzer mit installierter PWA werden bei neuem Post benachrichtigt (Web Push API + Supabase Realtime)

---

## Projektstruktur

```
app/
  page.tsx              # Hauptseite: Karte + Sidebar (Desktop) + Bottom Sheet (Mobile)
  post/page.tsx         # Mobiles Post-Formular (Passcode-geschützt)
  api/posts/route.ts    # GET / POST / DELETE Posts (DELETE prüft Passcode + löscht Bild)
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
supabase-schema.sql     # SQL für alle Tabellen (posts, comments, reactions)
```

---

## Supabase-Tabellen
| Tabelle | Felder | Besonderheit |
|---|---|---|
| `posts` | id, created_at, title, text, latitude, longitude, image_url, location_name, day_number | Realtime aktiv |
| `comments` | id, created_at, post_id, author_name, text | RLS: SELECT public |
| `reactions` | id, created_at, post_id | RLS: SELECT public |

---

## Wichtige Regeln für Code-Änderungen

- Kommentare auf Deutsch
- Nur anfassen was geändert werden muss
- `.env.local` niemals lesen, ausgeben oder committen
- Leaflet muss immer per `dynamic()` mit `ssr: false` geladen werden
- Passcode-Verifikation liegt ausschließlich in den API Routes (server-seitig)
- Lightboxen via `createPortal(…, document.body)` — nicht als Kind von transformierten Elementen
- Map-Callbacks (Like, Kommentar, Bild) über `window.__map*`-Globals (Leaflet HTML → React)
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
`UK2026` — zum Posten und Löschen (nur in `.env.local` / Vercel gespeichert, nie im Code)
