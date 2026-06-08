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

## Aktueller Stand (nach Session vom 08.06.2026)

### ✅ Erledigt
- App deployed auf Vercel (kostenlos, Hobby Plan)
- Supabase DB-Schema ausgeführt, Realtime für `posts` aktiv
- Kartenstil: CartoDB Light
- OSRM Straßenroute zwischen Posts (gestrichelt, grün)
- Reisestats in Sidebar: Strecke, Reisetage, Stopps, km/Tag
- Wetter-Widget via Open-Meteo (kostenlos, kein API-Key) — letzter Post-Koordinaten
- Mobile Bottom Sheet: eingeklappt zeigt letzten Post + KPIs, hochziehen zeigt alles
- Posts löschen: 🗑️ Icon auf PostCard, Passcode-Inline-Eingabe, löscht auch Bild aus Storage
- PWA Manifest + SVG-Icon (Schottland Saltire auf dunkelgrünem BG)
- Map-Bug behoben (StrictMode Doppelinitialisierung)

### 🔲 Offen / Nächste Session
- App-Icon als echte PNG-Datei (180×180px) für iPhone-Homescreen (iOS braucht PNG, nicht SVG)
- Icon-Design: Schottlandflagge auf dunkelgrünem Hintergrund `#0f1712` — morgen besprechen

---

## Projektstruktur

```
app/
  page.tsx              # Hauptseite: Karte + Sidebar (Desktop) + Bottom Sheet (Mobile)
  post/page.tsx         # Mobiles Post-Formular (Passcode-geschützt)
  api/posts/route.ts    # GET / POST / DELETE Posts (DELETE prüft Passcode + löscht Bild)
  api/upload/route.ts   # Foto-Upload zu Supabase Storage (bucket: trip-photos)
  globals.css           # Leaflet-Styles, Attribution-Styling, Popup-Styles
  layout.tsx            # Metadata, PWA-Config, Manifest-Referenz
components/
  Map.tsx               # Leaflet-Karte (dynamic/ssr:false), Marker, OSRM-Route
lib/
  supabase.ts           # Browser- und Server-Client
  types.ts              # Post Interface
public/
  manifest.json         # PWA Manifest
  icon.svg              # App-Icon (Schottland Saltire, dunkelgrün)
supabase-schema.sql     # SQL einmalig in Supabase SQL Editor ausführen
```

---

## Wichtige Regeln für Code-Änderungen

- Kommentare auf Deutsch
- Nur anfassen was geändert werden muss
- `.env.local` niemals lesen, ausgeben oder committen
- Leaflet muss immer per `dynamic()` mit `ssr: false` geladen werden
- Passcode-Verifikation liegt ausschließlich in den API Routes (server-seitig)
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

---

## Supabase – manuelle Schritte (bereits erledigt)
1. ✅ Projekt angelegt: usitibimgaedtgrscsvf
2. ✅ `supabase-schema.sql` im SQL Editor ausgeführt
3. ✅ Realtime aktiviert: Database → Publications → supabase_realtime → posts
4. ✅ API-Keys in `.env.local` und Vercel Environment Variables eingetragen

---

## Passcode
`UK2026` — zum Posten und Löschen (nur in `.env.local` / Vercel gespeichert, nie im Code)
