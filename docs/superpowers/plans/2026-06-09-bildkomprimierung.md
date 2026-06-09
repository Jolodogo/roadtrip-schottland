# Bildkomprimierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fotos werden vor dem Upload automatisch auf max. 1200px / 2 MB komprimiert — im Web Worker, unsichtbar für den Nutzer.

**Architecture:** `browser-image-compression` läuft in `handleImageChange` asynchron im Web Worker. Preview erscheint sofort (original), komprimiertes `File` ersetzt `imageFile` wenn fertig. Submit-Button gesperrt während Komprimierung.

**Tech Stack:** `browser-image-compression` ^2.x, Canvas API (intern), Web Worker API

---

### Task 1: Paket installieren

**Files:**
- Modify: `package.json` (automatisch via npm)

- [ ] **Step 1: Installieren**

```bash
cd "/Users/johncordes/Desktop/Claude/Roadtrip Schottland"
npm install browser-image-compression
```

Erwartete Ausgabe: `added X packages` ohne Fehler.

- [ ] **Step 2: Prüfen**

```bash
grep "browser-image-compression" "/Users/johncordes/Desktop/Claude/Roadtrip Schottland/package.json"
```

Erwartete Ausgabe: `"browser-image-compression": "^2.x.x"` in dependencies.

---

### Task 2: compressing-State + handleImageChange anpassen

**Files:**
- Modify: `app/post/page.tsx`

- [ ] **Step 1: Import am Dateianfang hinzufügen**

Direkt nach den bestehenden Imports (nach Zeile 5, vor `const Map = ...`):

```tsx
import imageCompression from 'browser-image-compression';
```

- [ ] **Step 2: `compressing` State nach `submitting` State einfügen**

```tsx
// vorher (Zeile 25):
const [submitting, setSubmitting] = useState(false);

// nachher:
const [submitting, setSubmitting] = useState(false);
const [compressing, setCompressing] = useState(false);
```

- [ ] **Step 3: `handleImageChange` ersetzen**

```tsx
// alt:
const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setImageFile(file);
  const reader = new FileReader();
  reader.onload = (ev) => setImagePreview(ev.target?.result as string);
  reader.readAsDataURL(file);
};

// neu:
const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  // Vorschau sofort anzeigen (Original)
  setImageFile(file);
  setImagePreview(URL.createObjectURL(file));
  setCompressing(true);
  try {
    const compressed = await imageCompression(file, {
      maxWidthOrHeight: 1200,
      initialQuality: 0.85,
      useWebWorker: true,
      fileType: 'image/jpeg',
      maxSizeMB: 2,
    });
    setImageFile(compressed);
  } catch {
    // Fallback: Original hochladen wenn Komprimierung fehlschlägt
  }
  setCompressing(false);
};
```

- [ ] **Step 4: Bild-Entfernen-Button auch `compressing` zurücksetzen**

```tsx
// alt (Zeile 239):
onClick={() => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}

// neu:
onClick={() => { setImageFile(null); setImagePreview(null); setCompressing(false); if (fileInputRef.current) fileInputRef.current.value = ''; }}
```

---

### Task 3: Komprimierungs-Badge + Submit-Button

**Files:**
- Modify: `app/post/page.tsx`

- [ ] **Step 1: Komprimierungs-Badge über Vorschaubild einfügen**

```tsx
// alt:
<div className="relative rounded-xl overflow-hidden">
  <img src={imagePreview} alt="Vorschau" className="w-full h-56 object-cover" />
  <button
    type="button"
    onClick={() => { setImageFile(null); setImagePreview(null); setCompressing(false); if (fileInputRef.current) fileInputRef.current.value = ''; }}
    className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg leading-none"
  >
    ×
  </button>
</div>

// neu:
<div className="relative rounded-xl overflow-hidden">
  <img src={imagePreview} alt="Vorschau" className="w-full h-56 object-cover" />
  {compressing && (
    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
      <span className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full animate-pulse">
        ⚙️ Komprimiert…
      </span>
    </div>
  )}
  <button
    type="button"
    onClick={() => { setImageFile(null); setImagePreview(null); setCompressing(false); if (fileInputRef.current) fileInputRef.current.value = ''; }}
    className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg leading-none"
  >
    ×
  </button>
</div>
```

- [ ] **Step 2: Submit-Button `disabled` um `compressing` erweitern**

```tsx
// alt (Zeile 388):
disabled={submitting || !title.trim() || !location}

// neu:
disabled={submitting || compressing || !title.trim() || !location}
```

---

### Task 4: Build + Commit

**Files:** keine neuen

- [ ] **Step 1: Build prüfen**

```bash
cd "/Users/johncordes/Desktop/Claude/Roadtrip Schottland"
npm run build 2>&1
```

Erwartete Ausgabe: Build grün, keine TypeScript-Fehler.

- [ ] **Step 2: Commit**

```bash
cd "/Users/johncordes/Desktop/Claude/Roadtrip Schottland"
git add app/post/page.tsx package.json package-lock.json docs/superpowers/specs/2026-06-09-bildkomprimierung-design.md docs/superpowers/plans/2026-06-09-bildkomprimierung.md
git commit -m "feat: Bildkomprimierung beim Upload (max. 1200px, 85% Qualität)

- browser-image-compression via Web Worker (kein UI-Freeze)
- HEIC → JPEG Konvertierung automatisch
- Preview sofort sichtbar, komprimierte File ersetzt Original
- Submit-Button gesperrt während Komprimierung
- Fallback auf Original bei Fehler

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
