# Roadtrip Schottland – Projektkontext für Claude Code

## Was ist das hier
Next.js 14 Web-App: Live-Tracking für einen Schottland-Roadtrip.
Öffentliche Karte mit Echtzeit-Markern, mobiles Post-Formular (Foto + GPS).

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Leaflet · Supabase

---

## Deine Aufgabe beim ersten Start

Führe diese Schritte der Reihe nach aus:

### 1. Prüfen ob .env.local existiert
```bash
ls -la .env.local
```
Falls nicht vorhanden:
```bash
cp .env.local.example .env.local
```
Dann stoppen und den Nutzer fragen: „Bitte trag deine Supabase-Keys und den Passcode in `.env.local` ein, dann sage mir Bescheid."

**WICHTIG: .env.local niemals committen, niemals lesen, niemals ausgeben.**

### 2. Dependencies installieren
```bash
npm install
```

### 3. Build-Check (erkennt Typfehler vor dem Deploy)
```bash
npm run build
```
Fehler beheben bevor weitergemacht wird.

### 4. Lokaler Test
```bash
npm run dev
```
Kurz prüfen ob der Server auf http://localhost:3000 antwortet.

### 5. Git initialisieren und auf GitHub pushen
```bash
git init
git add -A
git commit -m "Initial commit: Scotland Roadtrip App"
```
Dann den Nutzer fragen: „Soll ich ein GitHub-Repo erstellen? Wenn ja, gib mir den gewünschten Repo-Namen."

Mit `gh` CLI (falls installiert):
```bash
gh repo create REPO-NAME --public --source=. --push
```

### 6. Vercel Deployment
```bash
npm i -g vercel
vercel --prod
```
Bei der Vercel-Einrichtung: Framework = Next.js, Root Directory = `.`

Die Env-Variablen müssen in Vercel gesetzt werden. Den Nutzer darauf hinweisen:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSCODE`

---

## Projektstruktur

```
app/
  page.tsx          # Öffentliche Karten-Startseite mit Realtime-Feed
  post/page.tsx     # Mobile Post-Seite (Passcode-geschützt)
  api/posts/route.ts   # GET alle Posts / POST neuen Post
  api/upload/route.ts  # Foto-Upload zu Supabase Storage
components/
  Map.tsx           # Leaflet-Karte (dynamisch geladen, kein SSR)
lib/
  supabase.ts       # Supabase Browser- und Server-Client
  types.ts          # TypeScript Interfaces
supabase-schema.sql # SQL zum manuellen Ausführen in Supabase
```

---

## Wichtige Regeln für Code-Änderungen

- Kommentare auf Deutsch
- Nur anfassen was geändert werden muss
- `.env.local` niemals lesen, ausgeben oder committen
- Leaflet muss immer per `dynamic()` mit `ssr: false` geladen werden
- Passcode-Verifikation liegt ausschließlich in den API Routes (server-seitig)

---

## Supabase – manuelle Schritte (vom Nutzer erledigt)

Diese Dinge kann Claude Code nicht übernehmen — der Nutzer macht sie im Browser:
1. Supabase-Projekt anlegen: https://supabase.com
2. `supabase-schema.sql` im SQL Editor ausführen
3. Realtime aktivieren: Database → Replication → posts
4. API-Keys kopieren und in `.env.local` eintragen
