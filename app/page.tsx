'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Post } from '@/lib/types';

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
    <div className="px-3 pb-3 space-y-2">
      {location && <div className="text-green-400/40 text-[10px] truncate">📍 {location}</div>}
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

function PostCard({ post, isNewest }: { post: Post; isNewest: boolean }) {
  return (
    <div className={`rounded-xl overflow-hidden bg-[#1a2e1f] border transition-all ${
      isNewest ? 'border-green-500/50 shadow-lg shadow-green-900/20' : 'border-green-900/30'
    }`}>
      {post.image_url && (
        <img
          src={post.image_url}
          alt={post.title}
          className="w-full h-44 object-cover"
        />
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="text-[11px] text-green-400/60 leading-tight">
            {formatDate(post.created_at)}
            {post.location_name && (
              <span className="text-green-400/80"> · {post.location_name}</span>
            )}
          </div>
          {isNewest && (
            <span className="text-[10px] bg-green-600/30 text-green-400 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
              Neu
            </span>
          )}
        </div>
        <h3 className="text-white font-semibold text-sm leading-snug mb-1">{post.title}</h3>
        {post.text && (
          <p className="text-green-100/60 text-xs leading-relaxed line-clamp-3">{post.text}</p>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newPostCount, setNewPostCount] = useState(0);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLocation, setWeatherLocation] = useState<string | null>(null);

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
    setWeatherLocation(last.location_name || last.title);
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

  const tripDays = posts.length > 0
    ? Math.ceil((Date.now() - new Date(posts[posts.length - 1].created_at).getTime()) / 86400000)
    : 0;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0f1712]">
      {/* Header */}
      <header className="shrink-0 z-20 bg-[#0f1712]/90 backdrop-blur border-b border-green-900/40 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🏴󠁧󠁢󠁳󠁣󠁴󠁿</span>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">Schottland</h1>
            <p className="text-green-400/50 text-[11px]">
              {loading ? 'Lädt…' : `${posts.length} Posts · Tag ${tripDays > 0 ? tripDays : '–'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Feed toggle (mobile) */}
          <button
            onClick={() => { setSidebarOpen(!sidebarOpen); setNewPostCount(0); }}
            className="relative flex items-center gap-1.5 px-3 py-1.5 bg-[#1a2e1f] border border-green-900/50 rounded-lg text-green-300 text-xs font-medium hover:bg-[#1e3825] transition-colors md:hidden"
          >
            📋 Feed
            {newPostCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {newPostCount}
              </span>
            )}
          </button>
          <Link
            href="/post"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-semibold transition-colors active:scale-[0.97]"
          >
            + Post
          </Link>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map */}
        <div className="flex-1 relative">
          <Map posts={posts} />

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
                  <PostCard key={post.id} post={post} isNewest={i === 0} />
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

        {/* Mobile drawer */}
        {sidebarOpen && (
          <div className="md:hidden absolute inset-0 z-30 flex flex-col bg-[#0d1a10]">
            {/* Obere Hälfte: Posts */}
            <div className="h-1/2 flex flex-col min-h-0 border-b border-green-900/40">
              <div className="px-4 py-3 border-b border-green-900/30 flex items-center justify-between shrink-0">
                <span className="text-green-300/70 text-xs font-semibold uppercase tracking-wider">Updates</span>
                <button onClick={() => setSidebarOpen(false)} className="text-green-400/60 hover:text-green-300 text-2xl leading-none">×</button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                {loading ? (
                  <div className="text-green-500/30 text-sm text-center py-8 animate-pulse">Lädt…</div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">🗺️</div>
                    <p className="text-green-400/40 text-sm">Noch keine Posts.</p>
                  </div>
                ) : (
                  posts.map((post, i) => (
                    <PostCard key={post.id} post={post} isNewest={i === 0} />
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
          </div>
        )}
      </div>
    </div>
  );
}
