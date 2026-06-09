'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import imageCompression from 'browser-image-compression';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

type Step = 'passcode' | 'form';

export default function PostPage() {
  const [step, setStep] = useState<Step>('passcode');
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [locationName, setLocationName] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationMode, setLocationMode] = useState<'gps' | 'map'>('gps');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist passcode in sessionStorage for convenience
  useEffect(() => {
    const saved = sessionStorage.getItem('trip_passcode');
    if (saved) {
      setPasscode(saved);
      setStep('form');
    }
  }, []);

  const handlePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setPasscodeError('Passcode eingeben');
      return;
    }
    setPasscodeError('');
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: passcode.trim() }),
    });
    const { valid } = await res.json();
    if (!valid) {
      setPasscodeError('Falscher Passcode');
      return;
    }
    sessionStorage.setItem('trip_passcode', passcode.trim());
    setStep('form');
  };

  const handleGPS = useCallback(() => {
    setGpsLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      (err) => {
        setError('GPS nicht verfügbar: ' + err.message);
        setGpsLoading(false);
        setLocationMode('map');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Vorschau sofort anzeigen (Original), Komprimierung im Hintergrund
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) { setError('Titel eingeben'); return; }
    if (!location) { setError('Position auswählen'); return; }

    setSubmitting(true);

    try {
      let image_url: string | undefined;

      // Upload image first if present
      if (imageFile) {
        const fd = new FormData();
        fd.append('file', imageFile);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'x-passcode': passcode.trim() },
          body: fd,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || 'Upload fehlgeschlagen');
        }
        image_url = uploadData.url;
      }

      // Create post
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          text: text.trim() || undefined,
          latitude: location.lat,
          longitude: location.lng,
          image_url,
          location_name: locationName.trim() || undefined,
          passcode: passcode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem('trip_passcode');
          setStep('passcode');
          setPasscodeError('Falscher Passcode');
        }
        throw new Error(data.error || 'Fehler beim Speichern');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setText('');
    setLocationName('');
    setLocation(null);
    setImageFile(null);
    setImagePreview(null);
    setSubmitted(false);
    setError('');
  };

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0f1712] flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">🏴󠁧󠁢󠁳󠁣󠁴󠁿</div>
        <h2 className="text-2xl font-bold text-green-400 mb-2">Post veröffentlicht!</h2>
        <p className="text-green-200/60 mb-8">Alle können es jetzt auf der Karte sehen.</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={resetForm}
            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold transition-colors"
          >
            Weiteren Post erstellen
          </button>
          <Link
            href="/"
            className="w-full py-3 bg-[#1a2e1f] border border-green-900 text-green-300 rounded-xl font-semibold text-center transition-colors hover:bg-[#1e3825]"
          >
            Zur Karte
          </Link>
        </div>
      </div>
    );
  }

  // Passcode screen
  if (step === 'passcode') {
    return (
      <div className="min-h-screen bg-[#0f1712] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🔑</div>
            <h1 className="text-2xl font-bold text-white mb-1">Schottland-Roadtrip</h1>
            <p className="text-green-200/50 text-sm">Passcode zum Posten eingeben</p>
          </div>
          <form onSubmit={handlePasscode} className="space-y-4">
            <input
              type="password"
              value={passcode}
              onChange={(e) => { setPasscode(e.target.value); setPasscodeError(''); }}
              placeholder="Passcode"
              className="w-full px-4 py-3 bg-[#1a2e1f] border border-green-900 rounded-xl text-white text-lg text-center tracking-widest focus:outline-none focus:border-green-500 transition-colors"
              autoFocus
            />
            {passcodeError && <p className="text-red-400 text-sm text-center">{passcodeError}</p>}
            <button
              type="submit"
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold transition-colors"
            >
              Weiter
            </button>
          </form>
          <div className="mt-6 text-center">
            <Link href="/" className="text-green-500/60 text-sm hover:text-green-400">
              ← Zur Karte
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Post form
  return (
    <div className="min-h-screen bg-[#0f1712]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f1712]/95 backdrop-blur border-b border-green-900/40 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-green-400 text-sm font-medium">← Karte</Link>
        <h1 className="text-white font-semibold">Neuer Post</h1>
        <div className="w-16" />
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-5 pb-24">
        {/* Photo upload */}
        <div>
          <label className="block text-green-300/70 text-xs font-medium mb-2 uppercase tracking-wider">Foto</label>
          {imagePreview ? (
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
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-44 rounded-xl border-2 border-dashed border-green-800 bg-[#1a2e1f] flex flex-col items-center justify-center gap-2 text-green-400/60 hover:border-green-600 hover:text-green-400 transition-colors active:scale-[0.98]"
            >
              <span className="text-4xl">📸</span>
              <span className="text-sm font-medium">Foto auswählen</span>
              <span className="text-xs text-green-400/30">JPG, PNG, HEIC · max. 10 MB</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            capture="environment"
            onChange={handleImageChange}
            className="hidden"
          />
        </div>

        {/* Title */}
        <div>
          <label className="block text-green-300/70 text-xs font-medium mb-2 uppercase tracking-wider">Titel *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z.B. Ankunft in Edinburgh"
            className="w-full px-4 py-3 bg-[#1a2e1f] border border-green-900 rounded-xl text-white placeholder-green-900 focus:outline-none focus:border-green-500 transition-colors text-base"
            maxLength={80}
          />
        </div>

        {/* Text */}
        <div>
          <label className="block text-green-300/70 text-xs font-medium mb-2 uppercase tracking-wider">Nachricht</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Was erlebt ihr gerade? Snow macht bestimmt Blödsinn 🐾"
            rows={4}
            className="w-full px-4 py-3 bg-[#1a2e1f] border border-green-900 rounded-xl text-white placeholder-green-900 focus:outline-none focus:border-green-500 transition-colors text-base resize-none"
            maxLength={500}
          />
          <div className="text-right text-green-900 text-xs mt-1">{text.length}/500</div>
        </div>

        {/* Location name */}
        <div>
          <label className="block text-green-300/70 text-xs font-medium mb-2 uppercase tracking-wider">Ort (optional)</label>
          <input
            type="text"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="z.B. Loch Ness, Highlands"
            className="w-full px-4 py-3 bg-[#1a2e1f] border border-green-900 rounded-xl text-white placeholder-green-900 focus:outline-none focus:border-green-500 transition-colors text-base"
            maxLength={60}
          />
        </div>

        {/* Position */}
        <div>
          <label className="block text-green-300/70 text-xs font-medium mb-2 uppercase tracking-wider">Position *</label>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setLocationMode('gps')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                locationMode === 'gps'
                  ? 'bg-green-700 text-white'
                  : 'bg-[#1a2e1f] text-green-400/60 border border-green-900'
              }`}
            >
              📍 GPS
            </button>
            <button
              type="button"
              onClick={() => setLocationMode('map')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                locationMode === 'map'
                  ? 'bg-green-700 text-white'
                  : 'bg-[#1a2e1f] text-green-400/60 border border-green-900'
              }`}
            >
              🗺️ Karte
            </button>
          </div>

          {locationMode === 'gps' && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGPS}
                disabled={gpsLoading}
                className="w-full py-3 bg-[#1a2e1f] border border-green-800 rounded-xl text-green-300 font-medium flex items-center justify-center gap-2 hover:bg-[#1e3825] transition-colors disabled:opacity-50"
              >
                {gpsLoading ? (
                  <><span className="animate-spin">⏳</span> Suche GPS…</>
                ) : (
                  <><span>📍</span> Aktuelle Position verwenden</>
                )}
              </button>
              {location && locationMode === 'gps' && (
                <p className="text-green-400 text-xs text-center">
                  ✓ {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                </p>
              )}
            </div>
          )}

          {locationMode === 'map' && (
            <div className="space-y-2">
              <p className="text-green-400/50 text-xs">Auf der Karte tippen um Position zu setzen:</p>
              <div className="h-56 rounded-xl overflow-hidden border border-green-900">
                <Map
                  posts={[]}
                  onLocationSelect={(lat, lng) => setLocation({ lat, lng })}
                  interactive={true}
                  selectedLocation={location}
                />
              </div>
              {location && (
                <p className="text-green-400 text-xs text-center">
                  ✓ {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/40 text-red-300 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0f1712]/95 backdrop-blur border-t border-green-900/40 safe-bottom">
          <button
            type="submit"
            disabled={submitting || compressing || !title.trim() || !location}
            className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-green-900/40 disabled:text-green-700 text-white rounded-xl font-semibold text-base transition-colors active:scale-[0.98]"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> Wird veröffentlicht…
              </span>
            ) : (
              '📍 Post veröffentlichen'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
