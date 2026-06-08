'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Post, Comment } from '@/lib/types';

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0f1712]">
      <div className="text-green-500/40 text-sm animate-pulse">Karte lädt…</div>
    </div>
  ),
});

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcStats(posts: Post[]) {
  if (posts.length === 0) return { totalKm: 0, days: 0, stops: 0, kmPerDay: 0 };
  const sorted = [...posts].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let km = 0;
  for (let i = 1; i < sorted.length; i++) {
    km += haversineKm(sorted[i - 1].latitude, sorted[i - 1].longitude, sorted[i].latitude, sorted[i].longitude);
  }
  const totalKm = Math.round(km);
  const days = Math.max(1, Math.ceil(
    (new Date(sorted[sorted.length - 1].created_at).getTime() - new Date(sorted[0].created_at).getTime()) / 86400000
  ) + 1);
  return { totalKm, days, stops: posts.length, kmPerDay: Math.round(totalKm / days) };
}

function StatsPanel({ posts }: { posts: Post[] }) {
  const s = calcStats(posts);
  const items = [
    { label: 'Strecke', value: `${s.totalKm}`, unit: 'km' },
    { label: 'Reisetage', value: `${s.days}`, unit: 'Tage' },
    { label: 'Stopps', value: `${s.stops}`, unit: '' },
    { label: 'km/Tag', value: `${s.kmPerDay}`, unit: 'Ø' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {items.map(({ label, value, unit }) => (
        <div key={label} className="bg-[#0f1712] border border-green-900/30 rounded-lg px-3 py-2">
          <div className="text-green-400/40 text-[9px] uppercase tracking-wider mb-0.5">{label}</div>
          <div className="text-white font-semibold text-sm leading-tight truncate">
            {value}{unit && <span className="text-green-400/50 text-[11px] font-normal ml-1">{unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

interface WeatherData {
  temp: number;
  feelsLike: number;
  wind: number;
  code: number;
  tomorrowMax: number;
  tomorrowMin: number;
  tomorrowCode: number;
}

function wmoInfo(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: 'Klar' };
  if (code <= 2) return { icon: '🌤️', label: 'Teils bewölkt' };
  if (code === 3) return { icon: '☁️', label: 'Bedeckt' };
  if (code <= 48) return { icon: '🌫️', label: 'Nebel' };
  if (code <= 55) return { icon: '🌦️', label: 'Nieselregen' };
  if (code <= 65) return { icon: '🌧️', label: 'Regen' };
  if (code <= 77) return { icon: '❄️', label: 'Schnee' };
  if (code <= 82) return { icon: '🌧️', label: 'Schauer' };
  if (code <= 86) return { icon: '🌨️', label: 'Schneeschauer' };
  return { icon: '⛈️', label: 'Gewitter' };
}

function WeatherWidget({ weather, location }: { weather: WeatherData | null; location: string | null }) {
  if (!weather) return (
    <div className="px-3 pb-3 text-green-400/20 text-xs">Kein Standort verfügbar</div>
  );
  const now = wmoInfo(weather.code);
  const tmrw = wmoInfo(weather.tomorrowCode);
  return (
    <div className="px-3 pb-3 space-y-3">
      {location && <div className="text-green-400/40 text-[10px] truncate mt-1">📍 {location}</div>}
      {/* Aktuell */}
      <div className="bg-[#0f1712] border border-green-900/30 rounded-lg p-3 flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-2xl leading-none">{Math.round(weather.temp)}°</div>
          <div className="text-green-400/50 text-[11px] mt-0.5">{now.label} · Gefühlt {Math.round(weather.feelsLike)}°</div>
          <div className="text-green-400/40 text-[10px] mt-0.5">💨 {Math.round(weather.wind)} km/h</div>
        </div>
        <div className="text-4xl">{now.icon}</div>
      </div>
      {/* Morgen */}
      <div className="bg-[#0f1712] border border-green-900/30 rounded-lg px-3 py-2 flex items-center justify-between">
        <div>
          <div className="text-green-400/40 text-[9px] uppercase tracking-wider">Morgen</div>
          <div className="text-white text-sm font-medium mt-0.5">{tmrw.label}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl">{tmrw.icon}</span>
          <div className="text-right">
            <div className="text-white text-sm font-semibold">{Math.round(weather.tomorrowMax)}°</div>
            <div className="text-green-400/40 text-[11px]">{Math.round(weather.tomorrowMin)}°</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function PostCard({
  post, isNewest, onDelete, commentCount: initialCount = 0, autoOpenComments = false,
}: {
  post: Post;
  isNewest: boolean;
  onDelete?: (id: string) => void;
  commentCount?: number;
  autoOpenComments?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentCount, setCommentCount] = useState(initialCount);
  const [authorName, setAuthorName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Gespeicherten Namen aus localStorage laden
  useEffect(() => {
    const saved = localStorage.getItem('comment_author');
    if (saved) setAuthorName(saved);
  }, []);

  // Von Karte aus aufgerufen: scrollen + öffnen
  useEffect(() => {
    if (!autoOpenComments) return;
    setCommentsOpen(true);
    if (!commentsLoaded) loadComments();
    setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
  }, [autoOpenComments]);

  async function loadComments() {
    setCommentsLoading(true);
    const res = await fetch(`/api/comments?post_id=${post.id}`);
    if (res.ok) {
      const data: Comment[] = await res.json();
      setComments(data);
      setCommentCount(data.length);
      setCommentsLoaded(true);
    }
    setCommentsLoading(false);
  }

  function toggleComments() {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening && !commentsLoaded) loadComments();
  }

  async function handleSubmitComment() {
    if (!authorName.trim() || !commentText.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    localStorage.setItem('comment_author', authorName.trim());

    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: post.id, author_name: authorName.trim(), text: commentText.trim() }),
    });

    if (res.ok) {
      const newComment: Comment = await res.json();
      setComments((prev) => [...prev, newComment]);
      setCommentCount((prev) => prev + 1);
      setCommentText('');
    } else {
      const d = await res.json();
      setSubmitError(d.error || 'Fehler beim Senden');
    }
    setSubmitting(false);
  }

  async function handleDelete() {
    setDeleteError('');
    const res = await fetch('/api/posts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: post.id, passcode }),
    });
    if (res.ok) {
      onDelete?.(post.id);
    } else {
      const d = await res.json();
      setDeleteError(d.error || 'Fehler');
    }
  }

  return (
    <div ref={cardRef} className={`rounded-xl overflow-hidden bg-[#1a2e1f] border transition-all ${
      isNewest ? 'border-green-500/50 shadow-lg shadow-green-900/20' : 'border-green-900/30'
    }`}>
      {post.image_url && (
        <img src={post.image_url} alt={post.title} className="w-full h-44 object-cover" />
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="text-[11px] text-green-400/60 leading-tight">
            {formatDate(post.created_at)}
            {post.location_name && (
              <span className="text-green-400/80"> · {post.location_name}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isNewest && (
              <span className="text-[10px] bg-green-600/30 text-green-400 px-2 py-0.5 rounded-full font-medium">Neu</span>
            )}
            {onDelete && (
              <button
                onClick={() => { setDeleting(!deleting); setDeleteError(''); setPasscode(''); }}
                className="text-red-400/40 hover:text-red-400 text-xs px-1"
                title="Löschen"
              >🗑️</button>
            )}
          </div>
        </div>
        <h3 className="text-white font-semibold text-sm leading-snug mb-1">{post.title}</h3>
        {post.text && (
          <p className="text-green-100/60 text-xs leading-relaxed line-clamp-3">{post.text}</p>
        )}
        {deleting && (
          <div className="mt-2 flex gap-1">
            <input
              type="password"
              placeholder="Passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
              className="flex-1 bg-[#0f1712] border border-red-900/50 text-white text-xs px-2 py-1 rounded outline-none"
              autoFocus
            />
            <button onClick={handleDelete} className="bg-red-800 hover:bg-red-700 text-white text-xs px-2 py-1 rounded">
              Löschen
            </button>
          </div>
        )}
        {deleteError && <p className="text-red-400 text-[10px] mt-1">{deleteError}</p>}
      </div>

      {/* Kommentar-Toggle */}
      <button
        onClick={toggleComments}
        className="w-full flex items-center justify-between px-3 py-2 border-t border-green-900/20 text-green-400/50 hover:text-green-400/80 transition-colors text-xs"
      >
        <span>💬 {commentCount === 1 ? '1 Kommentar' : `${commentCount} Kommentare`}</span>
        <span>{commentsOpen ? '▲' : '▼'}</span>
      </button>

      {commentsOpen && (
        <div className="border-t border-green-900/20 bg-[#111e14]">
          {commentsLoading ? (
            <div className="text-center py-4 text-green-500/30 text-xs animate-pulse">Lädt…</div>
          ) : (
            <div className="p-3 space-y-2">
              {comments.length === 0 ? (
                <p className="text-green-400/30 text-xs text-center py-1">Noch kein Kommentar – sei der erste!</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="bg-[#1a2e1f] rounded-lg px-3 py-2">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-green-300/80 text-xs font-semibold">{c.author_name}</span>
                      <span className="text-green-400/30 text-[10px]">
                        {new Date(c.created_at).toLocaleDateString('de-DE', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-green-100/70 text-xs leading-relaxed">{c.text}</p>
                  </div>
                ))
              )}

              {/* Kommentar schreiben */}
              <div className="pt-1 space-y-1.5 border-t border-green-900/20 mt-2">
                <input
                  type="text"
                  placeholder="Dein Name *"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  maxLength={50}
                  className="w-full bg-[#0f1712] border border-green-900/40 text-white text-xs px-2.5 py-1.5 rounded-lg outline-none focus:border-green-700/60 placeholder-green-400/30"
                />
                <textarea
                  placeholder="Kommentar schreiben…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="w-full bg-[#0f1712] border border-green-900/40 text-white text-xs px-2.5 py-1.5 rounded-lg outline-none focus:border-green-700/60 placeholder-green-400/30 resize-none"
                />
                {submitError && <p className="text-red-400 text-[10px]">{submitError}</p>}
                <button
                  onClick={handleSubmitComment}
                  disabled={submitting || !authorName.trim() || !commentText.trim()}
                  className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs py-1.5 rounded-lg font-semibold transition-colors"
                >
                  {submitting ? 'Sendet…' : 'Kommentar senden'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [newPostCount, setNewPostCount] = useState(0);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLocation, setWeatherLocation] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openCommentForPost, setOpenCommentForPost] = useState<string | null>(null);
  const touchStartY = useRef<number | null>(null);

  const fetchPosts = useCallback(async () => {
    const res = await fetch('/api/posts');
    if (res.ok) {
      const data = await res.json();
      setPosts(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts();

    // Realtime subscription
    const channel = supabase
      .channel('posts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          setPosts((prev) => [payload.new as Post, ...prev]);
          setNewPostCount((n) => n + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  // Wetter vom letzten Post laden
  useEffect(() => {
    if (posts.length === 0) return;
    const last = posts[0]; // posts sind newest-first sortiert

    // Ort via Nominatim reverse geocoding ermitteln
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${last.latitude}&lon=${last.longitude}&format=json&accept-language=de`,
      { headers: { 'User-Agent': 'roadtrip-schottland-app' } }
    )
      .then((r) => r.json())
      .then((d) => {
        const a = d.address || {};
        const city = a.city || a.town || a.village || a.hamlet || a.county || '';
        const country = a.country || '';
        setWeatherLocation(city && country ? `${city}, ${country}` : (city || country || last.location_name || last.title));
      })
      .catch(() => setWeatherLocation(last.location_name || last.title));

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${last.latitude}&longitude=${last.longitude}` +
      `&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode&forecast_days=2&timezone=auto`
    )
      .then((r) => r.json())
      .then((d) => {
        setWeather({
          temp: d.current.temperature_2m,
          feelsLike: d.current.apparent_temperature,
          wind: d.current.windspeed_10m,
          code: d.current.weathercode,
          tomorrowMax: d.daily.temperature_2m_max[1],
          tomorrowMin: d.daily.temperature_2m_min[1],
          tomorrowCode: d.daily.weathercode[1],
        });
      })
      .catch(() => {});
  }, [posts]);

  // Kommentar-Anzahlen laden sobald Posts da sind
  useEffect(() => {
    if (posts.length === 0) return;
    fetch('/api/comments')
      .then((r) => r.json())
      .then((data) => setCommentCounts(data))
      .catch(() => {});
  }, [posts.length]);

  // Von Karte aus: Bottom Sheet öffnen + Kommentare für Post öffnen
  const handleMapCommentClick = useCallback((postId: string) => {
    setOpenCommentForPost(postId);
    setSheetExpanded(true);
    setTimeout(() => setOpenCommentForPost(null), 1500);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const tripDays = posts.length > 0
    ? Math.ceil((Date.now() - new Date(posts[posts.length - 1].created_at).getTime()) / 86400000)
    : 0;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0f1712]">
      {/* Header */}
      <header className="shrink-0 z-20 bg-[#0f1712]/90 backdrop-blur border-b border-green-900/40 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">Schottland-Roadtrip</h1>
            <p className="text-green-400/50 text-[11px]">
              {loading ? 'Lädt…' : `${posts.length} Posts · Tag ${tripDays > 0 ? tripDays : '–'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/post"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors active:scale-[0.97]"
          >
            + Post
          </Link>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map — z-0 + isolate: eigene Stacking-Context, Leaflet-interne z-Indizes bleiben eingeschlossen */}
        <div className="flex-1 relative z-0 isolate">
          <Map posts={posts} commentCounts={commentCounts} onCommentClick={handleMapCommentClick} />

          {/* Live indicator */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-[#0f1712]/80 backdrop-blur px-2.5 py-1 rounded-full border border-green-900/40">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 text-[11px] font-medium">Live</span>
          </div>

        </div>

        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-80 shrink-0 flex-col border-l border-green-900/40 bg-[#0d1a10] overflow-hidden">
          {/* Obere Hälfte: Posts */}
          <div className="h-1/2 flex flex-col min-h-0 border-b border-green-900/40">
            <div className="px-4 py-3 border-b border-green-900/30 flex items-center justify-between shrink-0">
              <span className="text-green-300/70 text-xs font-semibold uppercase tracking-wider">Updates</span>
              <span className="text-green-500/40 text-xs">{posts.length} Posts</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {loading ? (
                <div className="text-green-500/30 text-sm text-center py-8 animate-pulse">Lädt…</div>
              ) : posts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🗺️</div>
                  <p className="text-green-400/40 text-sm">Noch keine Posts.</p>
                  <p className="text-green-400/20 text-xs mt-1">Seid ihr schon unterwegs?</p>
                </div>
              ) : (
                posts.map((post, i) => (
                  <PostCard key={post.id} post={post} isNewest={i === 0} onDelete={handleDelete}
                    commentCount={commentCounts[post.id] || 0} />
                ))
              )}
            </div>
          </div>
          {/* Untere Hälfte: Stats + Wetter */}
          <div className="h-1/2 flex flex-col min-h-0 overflow-y-auto">
            <div className="px-4 py-3 border-b border-green-900/30 shrink-0">
              <span className="text-green-300/70 text-xs font-semibold uppercase tracking-wider">Reisestats</span>
            </div>
            <StatsPanel posts={posts} />
            <div className="px-4 py-3 border-t border-b border-green-900/30 shrink-0">
              <span className="text-green-300/70 text-xs font-semibold uppercase tracking-wider">Wetter</span>
            </div>
            <WeatherWidget weather={weather} location={weatherLocation} />
          </div>
        </aside>

        {/* Mobile Bottom Sheet */}
        <div
          className="md:hidden absolute bottom-0 left-0 right-0 z-30 bg-[#0d1a10] border-t border-green-900/40 flex flex-col"
          style={{
            height: '80vh',
            transform: sheetExpanded ? 'translateY(0)' : 'translateY(calc(100% - 168px))',
            transition: 'transform 0.3s ease-out',
          }}
          onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
          onTouchEnd={(e) => {
            if (touchStartY.current === null) return;
            const delta = touchStartY.current - e.changedTouches[0].clientY;
            if (delta > 30) setSheetExpanded(true);
            if (delta < -30) setSheetExpanded(false);
            touchStartY.current = null;
          }}
        >
          {/* Drag Handle */}
          <div
            className="shrink-0 flex flex-col items-center pt-2 pb-1 cursor-pointer"
            onClick={() => { setSheetExpanded(!sheetExpanded); setNewPostCount(0); }}
          >
            <div className="w-10 h-1 bg-green-700/50 rounded-full mb-2" />
            <div className="w-full flex items-center justify-between px-4">
              <span className="text-green-300/60 text-[10px] font-semibold uppercase tracking-wider">
                {sheetExpanded ? 'Updates' : (posts.length > 0 ? posts[0].title : 'Noch keine Posts')}
              </span>
              {newPostCount > 0 && (
                <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {newPostCount} neu
                </span>
              )}
              <span className="text-green-400/40 text-xs">{sheetExpanded ? '↓' : '↑'}</span>
            </div>
          </div>

          {/* Letzter Post kompakt (nur im collapsed Zustand sichtbar) */}
          {!sheetExpanded && posts.length > 0 && (() => {
            const p = posts[0];
            const s = calcStats(posts);
            return (
              <>
                <div className="px-3 py-2 flex items-center gap-3 border-t border-green-900/20">
                  {p.image_url && (
                    <img src={p.image_url} alt={p.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-white text-xs font-semibold truncate">{p.title}</div>
                    <div className="text-green-400/50 text-[10px] truncate">{p.location_name || formatDate(p.created_at)}</div>
                    {p.text && <div className="text-green-100/40 text-[10px] truncate">{p.text}</div>}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1 px-3 pb-3 pt-1 border-t border-green-900/20">
                  {[
                    { label: 'Strecke', value: `${s.totalKm} km` },
                    { label: 'Tage', value: `${s.days}` },
                    { label: 'Stopps', value: `${s.stops}` },
                    { label: 'km/Tag', value: `${s.kmPerDay}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-[#0f1712] border border-green-900/30 rounded px-2 py-1.5 text-center">
                      <div className="text-green-400/40 text-[8px] uppercase">{label}</div>
                      <div className="text-white text-[11px] font-semibold">{value}</div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}

          {/* Erweiterter Inhalt (scrollbar, nur sichtbar wenn expanded) */}
          {sheetExpanded && (
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* Posts */}
              <div className="p-3 space-y-3 border-b border-green-900/40">
                {loading ? (
                  <div className="text-green-500/30 text-sm text-center py-4 animate-pulse">Lädt…</div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-3xl mb-2">🗺️</div>
                    <p className="text-green-400/40 text-sm">Noch keine Posts.</p>
                  </div>
                ) : (
                  posts.map((post, i) => (
                    <PostCard key={post.id} post={post} isNewest={i === 0} onDelete={handleDelete}
                      commentCount={commentCounts[post.id] || 0}
                      autoOpenComments={openCommentForPost === post.id} />
                  ))
                )}
              </div>
              {/* Reisestats */}
              <div className="px-4 py-2 border-b border-green-900/30">
                <span className="text-green-300/70 text-xs font-semibold uppercase tracking-wider">Reisestats</span>
              </div>
              <StatsPanel posts={posts} />
              {/* Wetter */}
              <div className="px-4 py-2 border-t border-b border-green-900/30">
                <span className="text-green-300/70 text-xs font-semibold uppercase tracking-wider">Wetter</span>
              </div>
              <WeatherWidget weather={weather} location={weatherLocation} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
