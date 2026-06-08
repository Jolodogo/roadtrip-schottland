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
            <h1 className="text-white font-bold text-sm leading-tight">Scotland Roadtrip</h1>
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-white text-xs font-semibold transition-colors active:scale-[0.97]"
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
          <div className="px-4 py-3 border-b border-green-900/30 flex items-center justify-between">
            <span className="text-green-300/70 text-xs font-semibold uppercase tracking-wider">Updates</span>
            <span className="text-green-500/40 text-xs">{posts.length} Posts</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
        </aside>

        {/* Mobile drawer */}
        {sidebarOpen && (
          <div className="md:hidden absolute inset-0 z-30 flex flex-col bg-[#0d1a10]">
            <div className="px-4 py-3 border-b border-green-900/30 flex items-center justify-between shrink-0">
              <span className="text-green-300/70 text-xs font-semibold uppercase tracking-wider">Updates</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-green-400/60 hover:text-green-300 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
        )}
      </div>
    </div>
  );
}
