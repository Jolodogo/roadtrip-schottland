# Bildkomprimierung beim Upload — Design Spec
**Datum:** 2026-06-09  
**Feature:** Client-seitige Bildkomprimierung via browser-image-compression  

---

## Ziel
Fotos werden vor dem Upload automatisch auf max. 1200px + 2 MB komprimiert. Läuft im Web Worker (kein UI-Freeze). HEIC-Konvertierung zu JPEG automatisch.

---

## Paket
`browser-image-compression` — behandelt HEIC, Exif-Rotation, Web Worker, kein Server nötig.

---

## Einstellungen
```js
{
  maxWidthOrHeight: 1200,
  initialQuality: 0.85,
  useWebWorker: true,
  fileType: 'image/jpeg',
  maxSizeMB: 2,
}
```

---

## Dateifluss

```
handleImageChange(file)
  → setImagePreview(URL.createObjectURL(file))   // sofort anzeigen
  → setCompressing(true)
  → imageCompression(file, options)              // Web Worker
  → setImageFile(compressedFile)
  → setCompressing(false)

  bei Fehler:
  → setImageFile(originalFile)                   // Fallback
  → setCompressing(false)
```

---

## UI
- Vorschau erscheint sofort (Original)
- Während Komprimierung: kleines `Komprimiert…` Badge über Vorschaubild
- Submit-Button: disabled solange `compressing === true`

---

## Dateien die sich ändern
| Datei | Änderung |
|---|---|
| `app/post/page.tsx` | `browser-image-compression` import, `compressing` state, `handleImageChange` async |
| `package.json` | `browser-image-compression` hinzufügen |

---

## Verifikation
1. `npm run build` grün
2. Foto hochladen → in DevTools Network: Upload-Payload deutlich kleiner als Original
3. Hochgeladenes Bild in Supabase Storage: max. 1200px breit
