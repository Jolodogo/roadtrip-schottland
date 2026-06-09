# Offline-Caching — Design Spec
**Datum:** 2026-06-09  
**Feature:** PWA Offline-Caching via @ducanh2912/next-pwa  

---

## Ziel
Karte + Posts + Fotos bleiben bei schlechtem oder fehlendem Netz nutzbar. Nur gecacht was der User gesehen hat (kein Pre-Caching von Tiles).

---

## Architektur

### Paket
`@ducanh2912/next-pwa` — maintained Fork von next-pwa, unterstützt Next.js 15 App Router, Workbox intern.

### next.config.js
next-pwa wrapper um die bestehende Config. Generiert automatisch einen Service Worker (`/sw.js`) + Precache-Manifest beim Build.

### Caching-Regeln (Workbox RuntimeCaching)

| URL-Pattern | Strategie | Optionen |
|---|---|---|
| CartoDB Tiles (`*.basemaps.cartocdn.com/**`) | CacheFirst | cacheName: `map-tiles`, max 500 Einträge, 30 Tage |
| Supabase Storage Fotos (`*.supabase.co/storage/**`) | CacheFirst | cacheName: `post-images`, max 100 Einträge, 7 Tage |
| `/api/posts` | StaleWhileRevalidate | cacheName: `api-posts` |
| App-Shell (JS/CSS/HTML) | Precache (auto) | next-pwa Standard |
| Wetter/OSRM/Nominatim | NetworkOnly | Live-Daten offline sinnlos |

### Offline-Indikator
Kleines Banner in `page.tsx` (Header-Bereich): zeigt „Offline — gecachte Daten" wenn `navigator.onLine === false` + `window` event `online`/`offline`. Kein extra Fallback-Page.

---

## Dateien die sich ändern

| Datei | Änderung |
|---|---|
| `next.config.js` | next-pwa wrapper + RuntimeCaching-Regeln |
| `app/page.tsx` | Offline-Indikator (useState + window event) |
| `package.json` | `@ducanh2912/next-pwa` hinzufügen |

---

## Was sich NICHT ändert
- Kein manueller Service Worker
- Kein Fallback-Page
- Kein `next.config.ts` → bleibt `.js`
- Supabase Realtime funktioniert nur online (korrekt)

---

## Verifikation
1. `npm run build` grün
2. Chrome DevTools → Application → Service Workers: SW registriert
3. DevTools → Network → Offline setzen → App neu laden → Posts + Karte sichtbar
4. Offline-Banner erscheint
