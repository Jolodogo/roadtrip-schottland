# Offline-Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Karte + Posts + Fotos bleiben bei schlechtem/fehlendem Netz nutzbar via PWA Service Worker.

**Architecture:** `@ducanh2912/next-pwa` wraps die bestehende `next.config.js` und generiert automatisch einen Service Worker beim Build. Workbox RuntimeCaching-Regeln cachen Map-Tiles, Supabase-Fotos und den `/api/posts`-Endpoint. Ein Offline-Indikator in `page.tsx` informiert den User wenn er offline ist.

**Tech Stack:** `@ducanh2912/next-pwa` ^3.x, Workbox (intern), Next.js 15 App Router

---

### Task 1: Paket installieren

**Files:**
- Modify: `package.json` (automatisch via npm)

- [ ] **Step 1: Paket installieren**

```bash
cd "/Users/johncordes/Desktop/Claude/Roadtrip Schottland"
npm install @ducanh2912/next-pwa
```

Erwartete Ausgabe: `added X packages` ohne Fehler.

- [ ] **Step 2: Installation prüfen**

```bash
grep "@ducanh2912/next-pwa" package.json
```

Erwartete Ausgabe: `"@ducanh2912/next-pwa": "^3.x.x"` in dependencies.

---

### Task 2: next.config.js mit next-pwa wrappen

**Files:**
- Modify: `next.config.js`

- [ ] **Step 1: next.config.js ersetzen**

```js
const withPWA = require('@ducanh2912/next-pwa').default;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

module.exports = withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // CartoDB Kacheln: CacheFirst, 500 Einträge, 30 Tage
      {
        urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'map-tiles',
          expiration: {
            maxEntries: 500,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // Supabase Storage Fotos: CacheFirst, 100 Einträge, 7 Tage
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'post-images',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // /api/posts: StaleWhileRevalidate — sofort aus Cache, Hintergrund-Update
      {
        urlPattern: /^https?:\/\/.*\/api\/posts$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'api-posts',
          expiration: {
            maxEntries: 1,
            maxAgeSeconds: 24 * 60 * 60,
          },
        },
      },
    ],
  },
})(nextConfig);
```

- [ ] **Step 2: Build prüfen**

```bash
cd "/Users/johncordes/Desktop/Claude/Roadtrip Schottland"
npm run build 2>&1
```

Erwartete Ausgabe: Build grün, in `public/` existieren `sw.js` und `workbox-*.js`.

```bash
ls public/sw.js public/workbox-*.js
```

---

### Task 3: Offline-Indikator in page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Offline-State in `HomePage` hinzufügen**

In `HomePage`, nach den bestehenden `useState`-Deklarationen (ab Zeile ~423) einfügen:

```tsx
const [isOffline, setIsOffline] = useState(false);
```

- [ ] **Step 2: online/offline Event-Listener einfügen**

Nach dem bestehenden `fetchPosts`-useEffect (nach Zeile ~462) einfügen:

```tsx
// Online/Offline-Status überwachen
useEffect(() => {
  const update = () => setIsOffline(!navigator.onLine);
  update(); // Initialzustand setzen
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}, []);
```

- [ ] **Step 3: Offline-Banner im Header einfügen**

Im `<header>`-Element in `HomePage` (nach dem bestehenden `<div className="flex items-center gap-2">` am Ende des Headers, ca. Zeile ~550), das komplette Header-JSX wie folgt ergänzen — Banner direkt unter dem `<header>`-Tag, als eigenständiges `<div>` nach `</header>`:

```tsx
{isOffline && (
  <div className="shrink-0 bg-yellow-900/80 border-b border-yellow-700/50 px-4 py-1.5 text-center">
    <span className="text-yellow-300 text-xs font-medium">📡 Offline — gecachte Daten</span>
  </div>
)}
```

Einfügen zwischen `</header>` und dem `{/* Main layout */}`-Kommentar.

- [ ] **Step 4: Build prüfen**

```bash
cd "/Users/johncordes/Desktop/Claude/Roadtrip Schottland"
npm run build 2>&1
```

Erwartete Ausgabe: Build grün, keine TypeScript-Fehler.

- [ ] **Step 5: Commit**

```bash
cd "/Users/johncordes/Desktop/Claude/Roadtrip Schottland"
git add package.json package-lock.json next.config.js app/page.tsx public/sw.js public/workbox-*.js
git commit -m "feat: PWA Offline-Caching via next-pwa (Tiles, Fotos, Posts)"
```

---

### Task 4: Manuell verifizieren (Chrome DevTools)

- [ ] **Step 1: Dev-Server starten**

```bash
npm run build && npm run start
```

Öffne `http://localhost:3000` in Chrome.

- [ ] **Step 2: Service Worker prüfen**

DevTools → Application → Service Workers: SW mit Scope `/` muss als `activated and running` erscheinen.

- [ ] **Step 3: Offline testen**

DevTools → Network → Offline aktivieren → Seite neu laden (`Cmd+R`).

Erwartetes Ergebnis:
- Gelbes Offline-Banner erscheint
- Posts-Liste zeigt gecachte Daten
- Karte zeigt zuletzt gesehene Tiles

- [ ] **Step 4: Cache-Einträge prüfen**

DevTools → Application → Cache Storage: Caches `map-tiles`, `post-images`, `api-posts` sichtbar.
