# Icon-Modernisierung — Design Spec
**Datum:** 2026-06-09  
**Feature:** Emojis durch Lucide React SVG-Icons ersetzen

---

## Ziel
Einheitliche, moderne SVG-Icons wie Instagram/Linear — keine Emoji-Inkonsistenzen zwischen Plattformen.

## Bibliothek
`lucide-react` — MIT, tree-shakable, Standard im Next.js-Ökosystem

## Einstellungen
- `strokeWidth={1.5}` — dünn, modern
- Action-Icons: `w-5 h-5`
- Kleine Icons (PostCard): `w-4 h-4`

## Icon-Mapping

| Emoji | Lucide | Kontext |
|---|---|---|
| 🔕 | `BellOff` | Header, Push idle |
| 🔔 | `Bell` | Header, Push subscribed |
| ⏳ (spin) | `Loader2` + `animate-spin` | Header, Push loading |
| ❤️ / liked | `Heart` (outline / filled) | PostCard Like |
| 💬 | `MessageCircle` | PostCard Kommentare |
| 🗑️ | `Trash2` | PostCard Löschen |
| ✏️ | `Pencil` | PostCard Bearbeiten |
| 📍 | `MapPin` | Wetter-Location |
| `+ Post` | `Plus` + „Post" | Header-Button |

## Nicht geändert
- 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland Flag (Branding)
- Wetter-Icons ☀️🌧️ etc. (inhaltlich, nicht UI)
- Formular-Emojis in `/post/page.tsx`

## Dateien
| Datei | Änderung |
|---|---|
| `app/page.tsx` | Alle oben gelisteten Icon-Ersetzungen |
| `package.json` | `lucide-react` hinzufügen |
