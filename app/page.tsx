'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Post, Comment } from '@/lib/types';
import { Bell, BellOff, Loader2, Heart, MessageCircle, Trash2, Pencil, MapPin, Plus } from 'lucide-react';

// Konvertiert VAPID Public Key vom Base64-Format in ArrayBuffer für pushManager.subscribe()
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

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

// Posts nach Kalendertag gruppieren, neuester Tag zuerst
function groupByDay(posts: Post[]): { dateLabel: string; dayNum: number; posts: Post[] }[] {
  const map = new globalThis.Map<string, { dateLabel: string; dayNum: number; posts: Post[] }>();
  posts.forEach((post) => {
    const d = new Date(post.created_at);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const dateLabel = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
    if (!map.has(key)) map.set(key, { dateLabel, dayNum: map.size + 1, posts: [] });
    map.get(key)!.posts.push(post);
  });
  // Neuester Tag zuerst (posts kommen bereits desc sortiert rein)
  return Array.from(map.values());
}

function StatsPanel({ posts }: { posts: Post[] }) {
  const s = calcStats(posts);
  const items = [
    { label: 'Strecke', value: `${s.totalKm}`, unit: 'km' },
    { label: 'Reisetage', value: `${s.days}`, unit: '' },
    { label: 'Stopps', value: `${s.stops}`, unit: '' },
    { label: 'Strecke/Tag', value: `${s.kmPerDay}`, unit: 'km' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {items.map(({ label, value, unit }) => (
        <div key={label} className="bg-[#0f1712] border border-green-900/30 rounded-lg px-3 py-2">
          <div className="text-green-400/40 text-xs uppercase tracking-wider mb-0.5">{label}</div>
          <div className="text-white font-semibold text-lg leading-tight truncate">
            {value}{unit && <span className="text-green-400/50 text-sm font-normal ml-1">{unit}</span>}
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
      {location && <div className="text-green-400/40 text-[10px] truncate mt-1 flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" strokeWidth={1.5} />{location}</div>}
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
  post, isNewest, onDelete, onUpdate, commentCount: initialCount = 0, likeCount: initialLikes = 0, autoScrollTo = false, autoOpenComments = false,
}: {
  post: Post;
  isNewest: boolean;
  onDelete?: (id: string) => void;
  onUpdate?: (updated: Post) => void;
  commentCount?: number;
  likeCount?: number;
  autoScrollTo?: boolean;
  autoOpenComments?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [editing, setEditing] = useState(false);
  const [editPasscode, setEditPasscode] = useState('');
  const [editTitle, setEditTitle] = useState(post.title);
  const [editText, setEditText] = useState(post.text ?? '');
  const [editLocationName, setEditLocationName] = useState(post.location_name ?? '');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);

  useEffect(() => { setLiked(!!localStorage.getItem(`liked_${post.id}`)); }, [post.id]);

  async function handleLike() {
    if (liked || liking) return;
    setLiking(true);
    const res = await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: post.id }),
    });
    if (res.ok) {
      setLikes((n) => n + 1);
      setLiked(true);
      localStorage.setItem(`liked_${post.id}`, '1');
    }
    setLiking(false);
  }

  const [imgIndex, setImgIndex] = useState(0);
  const images = post.image_urls?.length ? post.image_urls : (post.image_url ? [post.image_url] : []);

  const [lightboxOpen, setLightboxOpen] = useState(false);
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

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    const res = await fetch(`/api/comments?post_id=${post.id}`);
    if (res.ok) {
      const data: Comment[] = await res.json();
      setComments(data);
      setCommentCount(data.length);
      setCommentsLoaded(true);
    }
    setCommentsLoading(false);
  }, [post.id]);

  // Von Karte aus: nur scrollen (für Like-Button)
  useEffect(() => {
    if (!autoScrollTo) return;
    const t = setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    return () => clearTimeout(t);
  }, [autoScrollTo]);

  // Von Karte aus aufgerufen: scrollen + öffnen
  useEffect(() => {
    if (!autoOpenComments) return;
    setCommentsOpen(true);
    if (!commentsLoaded) loadComments();
    const t = setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    return () => clearTimeout(t);
  }, [autoOpenComments, commentsLoaded, loadComments]);

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

  async function handleSaveEdit() {
    if (!editTitle.trim() || saving) return;
    setSaving(true);
    setEditError('');
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passcode: editPasscode,
        title: editTitle,
        text: editText,
        location_name: editLocationName,
      }),
    });
    if (res.ok) {
      const updated: Post = await res.json();
      onUpdate?.(updated);
      setEditing(false);
    } else {
      const d = await res.json();
      setEditError(d.error || 'Fehler');
    }
    setSaving(false);
  }

  return (
    <div ref={cardRef} className={`rounded-xl overflow-hidden bg-[#1a2e1f] border transition-all ${
      isNewest ? 'border-green-500/50 shadow-lg shadow-green-900/20' : 'border-green-900/30'
    }`}>
      {images.length > 0 && (
        <div className="relative">
          <img src={images[imgIndex]} alt={post.title} className="w-full h-44 object-cover" />
          {/* Prev/Next bei mehreren Bildern */}
          {images.length > 1 && (
            <>
              <button
                onClick={() => setImgIndex((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
              >‹</button>
              <button
                onClick={() => setImgIndex((i) => (i + 1) % images.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
              >›</button>
              {/* Punkt-Indikatoren */}
              <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-1">
                {images.map((_, i) => (
                  <button key={i} onClick={() => setImgIndex(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIndex ? 'bg-white' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            </>
          )}
          <button
            onClick={() => setLightboxOpen(true)}
            className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-lg p-1.5 backdrop-blur"
            title="Vergrößern"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        </div>
      )}

      {/* Lightbox — via Portal in document.body, umgeht CSS-transform des Bottom Sheets */}
      {lightboxOpen && images.length > 0 && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg font-light"
          >✕</button>
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setImgIndex((i) => (i - 1 + images.length) % images.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl">‹</button>
              <button onClick={(e) => { e.stopPropagation(); setImgIndex((i) => (i + 1) % images.length); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl">›</button>
              <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5">
                {images.map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full ${i === imgIndex ? 'bg-white' : 'bg-white/30'}`} />
                ))}
              </div>
            </>
          )}
          <img
            src={images[imgIndex]}
            alt={post.title}
            className="max-w-full max-h-full object-contain p-4"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
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
            {onUpdate && (
              <button
                onClick={() => { setEditing(!editing); setEditError(''); setEditPasscode(''); setEditTitle(post.title); setEditText(post.text ?? ''); setEditLocationName(post.location_name ?? ''); setDeleting(false); }}
                className="text-green-400/40 hover:text-green-400 text-xs px-1"
                title="Bearbeiten"
              ><Pencil className="w-4 h-4" strokeWidth={1.5} /></button>
            )}
            {onDelete && (
              <button
                onClick={() => { setDeleting(!deleting); setDeleteError(''); setPasscode(''); setEditing(false); }}
                className="text-red-400/40 hover:text-red-400 text-xs px-1"
                title="Löschen"
              ><Trash2 className="w-4 h-4" strokeWidth={1.5} /></button>
            )}
          </div>
        </div>
        <h3 className="text-white font-semibold text-sm leading-snug mb-1">{post.title}</h3>
        {post.text && (
          <p className="text-green-100/60 text-xs leading-relaxed line-clamp-3">{post.text}</p>
        )}
        {editing && (
          <div className="mt-2 space-y-1.5">
            <input
              type="password"
              placeholder="Passcode"
              value={editPasscode}
              onChange={(e) => setEditPasscode(e.target.value)}
              className="w-full bg-[#0f1712] border border-green-900/50 text-white text-xs px-2 py-1.5 rounded outline-none focus:border-green-600"
              autoFocus
            />
            <input
              type="text"
              placeholder="Titel"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-[#0f1712] border border-green-900/50 text-white text-xs px-2 py-1.5 rounded outline-none focus:border-green-600"
              maxLength={80}
            />
            <textarea
              placeholder="Text (optional)"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="w-full bg-[#0f1712] border border-green-900/50 text-white text-xs px-2 py-1.5 rounded outline-none focus:border-green-600 resize-none"
              maxLength={500}
            />
            <input
              type="text"
              placeholder="Ort (optional)"
              value={editLocationName}
              onChange={(e) => setEditLocationName(e.target.value)}
              className="w-full bg-[#0f1712] border border-green-900/50 text-white text-xs px-2 py-1.5 rounded outline-none focus:border-green-600"
              maxLength={60}
            />
            <div className="flex gap-1">
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editTitle.trim()}
                className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs px-2 py-1.5 rounded"
              >
                {saving ? 'Speichert…' : 'Speichern'}
              </button>
              <button
                onClick={() => { setEditing(false); setEditError(''); }}
                className="bg-[#0f1712] border border-green-900/40 text-green-400/60 text-xs px-2 py-1.5 rounded"
              >
                Abbrechen
              </button>
            </div>
            {editError && <p className="text-red-400 text-[10px]">{editError}</p>}
          </div>
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

      {/* Like + Kommentar-Leiste */}
      <div className="flex items-center border-t border-green-900/20">
        <button
          onClick={handleLike}
          disabled={liked || liking}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs transition-colors ${liked ? 'text-red-400' : 'text-green-400/40 hover:text-red-400/70'}`}
          title={liked ? 'Bereits geliked' : 'Liken'}
        >
          <Heart className="w-4 h-4" strokeWidth={1.5} fill={liked ? 'currentColor' : 'none'} />
          <span>{likes > 0 ? likes : ''}</span>
        </button>
        <div className="w-px h-4 bg-green-900/20" />
        <button
          onClick={toggleComments}
          className="flex-1 flex items-center justify-between px-3 py-2 text-green-400/50 hover:text-green-400/80 transition-colors text-xs"
        >
        <span className="flex items-center gap-1.5"><MessageCircle className="w-4 h-4" strokeWidth={1.5} />{commentCount === 1 ? '1 Kommentar' : `${commentCount} Kommentare`}</span>
          <span>{commentsOpen ? '▲' : '▼'}</span>
        </button>
      </div>

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
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [openCommentForPost, setOpenCommentForPost] = useState<string | null>(null);
  const [scrollToPost, setScrollToPost] = useState<string | null>(null);
  const [mapLightboxSrc, setMapLightboxSrc] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [pushState, setPushState] = useState<'idle' | 'loading' | 'subscribed' | 'denied'>('idle');
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const touchStartY = useRef<number | null>(null);

  // Online/Offline-Status überwachen
  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Initialen Push-Status ermitteln
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'denied') {
      setPushState('denied');
    } else if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription()
      ).then((sub) => {
        if (sub) setPushState('subscribed');
      }).catch(() => {});
    }
  }, []);

  const handlePushSubscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setPushState('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();

      // Abonnement deaktivieren wenn bereits aktiv
      if (existing) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        await existing.unsubscribe();
        setPushState('idle');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushState('denied');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setPushState('subscribed');
    } catch (err) {
      console.error('Push-Subscription fehlgeschlagen:', err);
      setPushState('idle');
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    const res = await fetch('/api/posts');
    if (res.ok) {
      const data = await res.json();
      setPosts(data);
    }
    setLoading(false);
  }, []);

  // Posts neu laden wenn App wieder in den Vordergrund kommt (PWA-Pattern)
  // Deckt ab: Rückkehr von /post, App-Switch, Tab-Wechsel
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchPosts();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchPosts]);

  useEffect(() => {
    fetchPosts();

    // Realtime subscription — INSERT, UPDATE, DELETE
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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => {
          setPosts((prev) => prev.map((p) => p.id === payload.new.id ? payload.new as Post : p));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => {
          setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  // Wetter nur laden wenn sich der neueste Post ändert (nicht bei jedem Realtime-Update)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [posts[0]?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kommentar- und Like-Anzahlen laden sobald Posts da sind
  useEffect(() => {
    if (posts.length === 0) return;
    fetch('/api/comments').then((r) => r.json()).then(setCommentCounts).catch(() => {});
    fetch('/api/reactions').then((r) => r.json()).then(setLikeCounts).catch(() => {});
  }, [posts.length]);

  const handleMapLikeClick = useCallback((postId: string) => {
    setScrollToPost(postId);
    setSheetExpanded(true);
    setTimeout(() => setScrollToPost(null), 1500);
  }, []);

  const handleMapCommentClick = useCallback((postId: string) => {
    setOpenCommentForPost(postId);
    setSheetExpanded(true);
    setTimeout(() => setOpenCommentForPost(null), 1500);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleUpdate = useCallback((updated: Post) => {
    setPosts((prev) => prev.map((p) => p.id === updated.id ? updated : p));
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
            <h1 className="text-white font-bold text-base leading-tight">Schottland-Roadtrip</h1>
            <p className="text-green-400/50 text-[11px]">
              {loading ? 'Lädt…' : `${posts.length} Posts · Tag ${tripDays > 0 ? tripDays : '–'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mounted && 'Notification' in window && pushState !== 'denied' && (
            <button
              onClick={handlePushSubscribe}
              disabled={pushState === 'loading'}
              title={pushState === 'subscribed' ? 'Benachrichtigungen deaktivieren' : 'Benachrichtigungen aktivieren'}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                pushState === 'subscribed'
                  ? 'text-green-400'
                  : 'text-white/40 hover:text-white/70 hover:bg-green-900/30'
              }`}
            >
              {pushState === 'loading' ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
              ) : pushState === 'subscribed' ? (
                <Bell className="w-4 h-4" strokeWidth={1.5} />
              ) : (
                <BellOff className="w-4 h-4" strokeWidth={1.5} />
              )}
            </button>
          )}
          <Link
            href="/post"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors active:scale-[0.97]"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />Post
          </Link>
        </div>
      </header>

      {/* Offline-Banner */}
      {isOffline && (
        <div className="shrink-0 bg-yellow-900/80 border-b border-yellow-700/50 px-4 py-1.5 text-center">
          <span className="text-yellow-300 text-xs font-medium">📡 Offline — gecachte Daten</span>
        </div>
      )}

      {/* Lightbox für Map-Popup Bilder */}
      {mapLightboxSrc && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center" onClick={() => setMapLightboxSrc(null)}>
          <button onClick={() => setMapLightboxSrc(null)} className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg">✕</button>
          <img src={mapLightboxSrc} className="max-w-full max-h-full object-contain p-4" onClick={(e) => e.stopPropagation()} />
        </div>,
        document.body
      )}

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map — z-0 + isolate: eigene Stacking-Context, Leaflet-interne z-Indizes bleiben eingeschlossen */}
        <div className="flex-1 relative z-0 isolate">
          <Map posts={posts} commentCounts={commentCounts} likeCounts={likeCounts} onLikeClick={handleMapLikeClick} onCommentClick={handleMapCommentClick} onImageExpand={setMapLightboxSrc} />

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
                groupByDay(posts).map((group) => (
                  <div key={group.dateLabel}>
                    <div className="flex items-center gap-2 mb-2 mt-1">
                      <div className="flex-1 h-px bg-green-900/40" />
                      <span className="text-green-400/50 text-[10px] uppercase tracking-wider font-medium whitespace-nowrap">
                        Tag {group.dayNum} · {group.dateLabel}
                      </span>
                      <div className="flex-1 h-px bg-green-900/40" />
                    </div>
                    {group.posts.map((post) => (
                      <PostCard key={post.id} post={post} isNewest={posts[0]?.id === post.id} onDelete={handleDelete} onUpdate={handleUpdate}
                        commentCount={commentCounts[post.id] || 0}
                        likeCount={likeCounts[post.id] || 0}
                        autoScrollTo={scrollToPost === post.id} />
                    ))}
                  </div>
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
              <span className="text-green-300/70 text-sm font-semibold uppercase tracking-wider">
                Updates
              </span>
              {newPostCount > 0 && (
                <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {newPostCount} neu
                </span>
              )}
              <span className="text-green-400/60 text-lg">{sheetExpanded ? '↓' : '↑'}</span>
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
                    { label: 'Strecke/Tag', value: `${s.kmPerDay} km` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-[#0f1712] border border-green-900/30 rounded px-2 py-1.5 text-center">
                      <div className="text-green-400/40 text-[10px] uppercase tracking-wide">{label}</div>
                      <div className="text-white text-xs font-semibold">{value}</div>
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
                  groupByDay(posts).map((group) => (
                    <div key={group.dateLabel}>
                      {/* Tag-Trennlinie */}
                      <div className="flex items-center gap-2 mb-2 mt-1">
                        <div className="flex-1 h-px bg-green-900/40" />
                        <span className="text-green-400/50 text-[10px] uppercase tracking-wider font-medium whitespace-nowrap">
                          Tag {group.dayNum} · {group.dateLabel}
                        </span>
                        <div className="flex-1 h-px bg-green-900/40" />
                      </div>
                      <div className="space-y-3">
                        {group.posts.map((post, i) => (
                          <PostCard key={post.id} post={post} isNewest={posts[0]?.id === post.id} onDelete={handleDelete} onUpdate={handleUpdate}
                            commentCount={commentCounts[post.id] || 0}
                            likeCount={likeCounts[post.id] || 0}
                            autoScrollTo={scrollToPost === post.id}
                            autoOpenComments={openCommentForPost === post.id} />
                        ))}
                      </div>
                    </div>
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
