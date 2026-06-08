# 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland Roadtrip – Setup Guide

## Was du bekommst

- Öffentliche Live-Karte (Leaflet, Dark Mode) mit Foto-Popups
- Realtime-Updates — Besucher sehen neue Posts ohne Reload
- Mobile Post-Seite (`/post`) — GPS oder Karte, Foto-Upload, Passcode-geschützt
- Vercel Deployment in ~5 Minuten

---

## Schritt 1 – Supabase Projekt anlegen

1. Gehe zu [supabase.com](https://supabase.com) → "New project"
2. Region: **EU West** (Frankfurt) empfohlen
3. Warte bis das Projekt fertig ist (~2 min)

### Datenbank aufsetzen

1. Im Dashboard: **SQL Editor** → "New query"
2. Kopiere den Inhalt von `supabase-schema.sql` und führe ihn aus

### Realtime aktivieren

1. **Database** → **Replication**
2. Bei der Tabelle `posts` Realtime einschalten

### API Keys holen

1. **Settings** → **API**
2. Notiere dir:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` Key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` Key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Schritt 2 – Projekt lokal aufsetzen

```bash
# Ins Projektverzeichnis
cd scotland-roadtrip

# Env-Datei erstellen
cp .env.local.example .env.local
# Jetzt .env.local mit deinen Werten füllen

# Dependencies installieren
npm install

# Lokaler Dev-Server
npm run dev
# → http://localhost:3000
```

---

## Schritt 3 – Vercel Deployment

1. Pushe das Projekt auf GitHub (neues Repo)
2. Gehe zu [vercel.com](https://vercel.com) → "Add New Project"
3. GitHub Repo auswählen → Import
4. **Environment Variables** setzen (alle 4 aus `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSCODE`
5. Deploy klicken → in ~2 Minuten live

### Tipp: Custom Domain (optional)
In Vercel unter "Domains" kannst du eine eigene Domain hinzufügen, z.B. `scotland.euerename.de`.

---

## Nutzung unterwegs

### Posten (nur ihr):
1. `deine-url.vercel.app/post` öffnen
2. Passcode eingeben (wird im Browser gespeichert — einmal reicht)
3. Foto aufnehmen, Titel/Text eingeben, GPS-Position nutzen → Veröffentlichen

### Für Familie & Freunde:
Einfach die Hauptseite `deine-url.vercel.app` teilen — kein Account, kein Download nötig.
Neue Posts erscheinen automatisch in Echtzeit auf der Karte.

---

## Dateistruktur

```
scotland-roadtrip/
├── app/
│   ├── page.tsx          # Öffentliche Karten-Startseite
│   ├── post/page.tsx     # Mobile Post-Seite (passcode-geschützt)
│   └── api/
│       ├── posts/route.ts   # GET alle Posts, POST neuen Post
│       └── upload/route.ts  # Foto-Upload zu Supabase Storage
├── components/
│   └── Map.tsx           # Leaflet Karte (dynamisch geladen)
├── lib/
│   ├── supabase.ts       # Supabase Client
│   └── types.ts          # TypeScript Typen
├── supabase-schema.sql   # Datenbank-Schema zum Ausführen
└── .env.local.example    # Env-Vorlage
```

---

## Troubleshooting

**Karte lädt nicht?** → Leaflet braucht `'use client'` + dynamischen Import. Bereits so konfiguriert.

**Upload schlägt fehl?** → In Supabase unter Storage prüfen ob der `trip-photos` Bucket existiert und public ist.

**Realtime funktioniert nicht?** → Unter Database → Replication die `posts` Tabelle aktivieren.

**HEIC-Fotos vom iPhone?** → Supabase Storage akzeptiert HEIC. Alternativ im iPhone-Einstellungen auf JPEG umstellen (Kamera → Formate → Maximale Kompatibilität).

---

Gute Reise! 🐾🏔️
