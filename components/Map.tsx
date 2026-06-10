'use client';

import { useEffect, useRef, useState } from 'react';
import { Post } from '@/lib/types';

interface MapProps {
  posts: Post[];
  onLocationSelect?: (lat: number, lng: number) => void;
  interactive?: boolean;
  selectedLocation?: { lat: number; lng: number } | null;
  commentCounts?: Record<string, number>;
  likeCounts?: Record<string, number>;
  onLikeClick?: (postId: string) => void;
  onCommentClick?: (postId: string) => void;
  onImageExpand?: (url: string) => void;
  onRouteDistance?: (km: number) => void;
}

// XSS-Schutz: HTML-Sonderzeichen in Attributen/Textknoten escapen
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Popup-HTML aus Post-Daten bauen — alle User-Inhalte escaped
function buildPopupContent(
  post: Post,
  commentCounts: Record<string, number> | undefined,
  likeCounts: Record<string, number> | undefined,
): string {
  const dateStr = new Date(post.created_at).toLocaleDateString('de-DE', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  const likeCount = likeCounts?.[post.id] ?? 0;
  const commentCount = commentCounts?.[post.id] ?? 0;

  // Alle Bilder sammeln (Rückwärtskompatibilität: image_urls bevorzugt, sonst image_url)
  const images = post.image_urls?.length ? post.image_urls : (post.image_url ? [post.image_url] : []);
  const hasImages = images.length > 0;
  const multiImg = images.length > 1;
  // Bilder pipe-separiert im data-Attribut — Browser dekodiert HTML-Entities beim Lesen zurück
  const imgsData = images.map((u) => escapeHtml(u)).join('|');
  const pid = post.id; // UUID, sicher als HTML-ID

  return `
    <div style="font-family: Inter, sans-serif; color: #f0f8f0; min-width: 200px;">
      ${hasImages ? `
        <div id="ppc-${pid}" data-imgs="${imgsData}" data-idx="0"
          style="position:relative;margin:-1px -1px 0;overflow:hidden;border-radius:12px 12px 0 0;">
          <img id="ppi-${pid}" src="${escapeHtml(images[0])}" alt="${escapeHtml(post.title)}"
            style="width:100%;height:160px;object-fit:cover;display:block;" />
          ${multiImg ? `
            <button data-postid="${pid}" data-dir="-1"
              onclick="if(window.__mapCarouselNav)window.__mapCarouselNav(this.dataset.postid,-1)"
              style="position:absolute;left:6px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.55);color:white;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:16px;line-height:1;">‹</button>
            <button data-postid="${pid}" data-dir="1"
              onclick="if(window.__mapCarouselNav)window.__mapCarouselNav(this.dataset.postid,1)"
              style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.55);color:white;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:16px;line-height:1;">›</button>
            <div style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);display:flex;gap:4px;">
              ${images.map((_, i) => `<span class="ppd-${pid}" style="width:5px;height:5px;border-radius:50%;background:white;opacity:${i === 0 ? '1' : '0.35'};display:inline-block;transition:opacity .2s;"></span>`).join('')}
            </div>
          ` : ''}
          <button data-postid="${pid}"
            onclick="if(window.__mapImageExpand){var el=document.getElementById('ppi-${pid}');if(el)window.__mapImageExpand(el.src);}"
            style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.55);color:white;border:none;border-radius:8px;padding:5px 7px;cursor:pointer;line-height:1;">⤢</button>
        </div>
      ` : ''}
      <div style="padding: 12px;">
        <div style="font-size: 11px; color: #4ade80; margin-bottom: 4px;">${escapeHtml(dateStr)}${post.location_name ? ` · ${escapeHtml(post.location_name)}` : ''}</div>
        <div style="font-size: 15px; font-weight: 600; margin-bottom: 6px; line-height: 1.3;">${escapeHtml(post.title)}</div>
        ${post.text ? `<div style="font-size: 13px; color: #bbf7d0; line-height: 1.5;">${escapeHtml(post.text)}</div>` : ''}
        <div style="margin-top:10px;display:flex;gap:8px;">
          <button
            data-postid="${post.id}"
            onclick="if(window.__mapLikeClick)window.__mapLikeClick(this.dataset.postid)"
            style="background:#1a1a1a;border:1px solid #2a2a2a;color:#f87171;font-size:12px;padding:6px 10px;border-radius:8px;min-width:48px;text-align:center;cursor:pointer;"
          ><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>${likeCount}</button>
          <button
            data-postid="${post.id}"
            onclick="if(window.__mapCommentClick)window.__mapCommentClick(this.dataset.postid)"
            style="flex:1;background:#14532d;border:1px solid #166534;color:#86efac;font-size:12px;padding:6px 10px;border-radius:8px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px;"
          ><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>${commentCount} Kommentar${commentCount !== 1 ? 'e' : ''}</button>
        </div>
      </div>
    </div>
  `;
}

export default function Map({
  posts,
  onLocationSelect,
  interactive = false,
  selectedLocation,
  commentCounts,
  likeCounts,
  onLikeClick,
  onCommentClick,
  onImageExpand,
  onRouteDistance,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const markerPostIdsRef = useRef<string[]>([]);
  const routeLinesRef = useRef<any[]>([]);
  const selectionMarkerRef = useRef<any>(null);
  const initializingRef = useRef(false);
  // Counts in Refs halten damit Popup-Update kein Marker-Rebuild auslöst
  const commentCountsRef = useRef(commentCounts);
  const likeCountsRef = useRef(likeCounts);
  const postsRef = useRef(posts);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => { commentCountsRef.current = commentCounts; }, [commentCounts]);
  useEffect(() => { likeCountsRef.current = likeCounts; }, [likeCounts]);
  useEffect(() => { postsRef.current = posts; }, [posts]);

  // Karte initialisieren
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || initializingRef.current) return;
    initializingRef.current = true;

    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [57.0, -4.2],
        zoom: 6,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(map);

      mapInstanceRef.current = map;
      setIsLoaded(true);

      if (interactive && onLocationSelect) {
        map.on('click', (e: any) => {
          onLocationSelect(e.latlng.lat, e.latlng.lng);
        });
      }

      // Swipe-Geste für Popup-Karussell — Touch-Listener nach Popup-Öffnung anhängen
      map.on('popupopen', () => {
        setTimeout(() => {
          document.querySelectorAll('[id^="ppc-"]').forEach((el) => {
            if ((el as HTMLElement).dataset.swipe) return; // Kein doppelter Listener
            (el as HTMLElement).dataset.swipe = '1';
            const postId = el.id.replace('ppc-', '');
            let startX = 0;
            el.addEventListener('touchstart', (e) => {
              startX = (e as TouchEvent).touches[0].clientX;
            }, { passive: true });
            el.addEventListener('touchend', (e) => {
              const dx = (e as TouchEvent).changedTouches[0].clientX - startX;
              if (Math.abs(dx) > 40 && (window as any).__mapCarouselNav) {
                (window as any).__mapCarouselNav(postId, dx < 0 ? 1 : -1);
              }
            }, { passive: true });
          });
        }, 50);
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Window-Callbacks aktualisieren ohne Marker-Rebuild
  useEffect(() => {
    (window as any).__mapLikeClick = onLikeClick;
    (window as any).__mapCommentClick = onCommentClick;
    (window as any).__mapImageExpand = onImageExpand;

    // Carousel-Navigation im Popup — reines DOM-Manipulation ohne React
    (window as any).__mapCarouselNav = (postId: string, dir: number) => {
      const container = document.getElementById(`ppc-${postId}`);
      if (!container) return;
      const imgs = container.dataset.imgs!.split('|');
      const newIdx = (parseInt(container.dataset.idx ?? '0') + dir + imgs.length) % imgs.length;
      container.dataset.idx = String(newIdx);
      const imgEl = document.getElementById(`ppi-${postId}`) as HTMLImageElement | null;
      if (imgEl) imgEl.src = imgs[newIdx];
      // Dots aktualisieren
      container.querySelectorAll(`span.ppd-${postId}`).forEach((dot, i) => {
        (dot as HTMLElement).style.opacity = i === newIdx ? '1' : '0.35';
      });
    };
  }, [onLikeClick, onCommentClick, onImageExpand]);

  // Marker neu aufbauen NUR wenn Posts sich ändern (nicht bei Count-Updates)
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      markerPostIdsRef.current = [];

      posts.forEach((post, index) => {
        const isNewest = index === 0;

        const iconHtml = `
          <div style="
            width: 36px; height: 36px;
            background: ${isNewest ? '#22c55e' : '#16a34a'};
            border: 3px solid ${isNewest ? '#86efac' : '#4ade80'};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            ${isNewest ? 'animation: markerPulse 2s ease-in-out infinite;' : ''}
          "></div>
        `;

        const icon = L.divIcon({
          html: iconHtml,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -36],
        });

        const marker = L.marker([post.latitude, post.longitude], { icon });
        marker.bindPopup(
          buildPopupContent(post, commentCountsRef.current, likeCountsRef.current),
          { maxWidth: 280, className: 'custom-popup' }
        );
        marker.addTo(mapInstanceRef.current);
        markersRef.current.push(marker);
        markerPostIdsRef.current.push(post.id);
      });

      if (posts.length > 0 && !interactive) {
        const group = L.featureGroup(markersRef.current);
        mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2), { maxZoom: 10 });
      }
    });
  }, [posts, isLoaded, interactive]);

  // Popup-Inhalte aktualisieren wenn Counts sich ändern — kein Marker-Rebuild
  useEffect(() => {
    if (!isLoaded || markersRef.current.length === 0) return;
    postsRef.current.forEach((post) => {
      const idx = markerPostIdsRef.current.indexOf(post.id);
      if (idx === -1) return;
      markersRef.current[idx]?.getPopup()?.setContent(
        buildPopupContent(post, commentCounts, likeCounts)
      );
    });
  }, [commentCounts, likeCounts, isLoaded]);

  // Straßenroute (OSRM) — alle Requests parallel statt sequentiell
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || interactive) return;
    if (posts.length < 2) return;

    const sorted = [...posts].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    import('leaflet').then(async (L) => {
      routeLinesRef.current.forEach((l) => l.remove());
      routeLinesRef.current = [];

      const lineStyle = { color: '#16a34a', weight: 3, opacity: 0.7, dashArray: '8 6' };

      // Distanzen parallel holen, summieren und als Callback zurückgeben
      const distances = await Promise.all(
        Array.from({ length: sorted.length - 1 }, async (_, i) => {
          const a = sorted[i];
          const b = sorted[i + 1];
          try {
            const res = await fetch(
              `https://router.project-osrm.org/route/v1/driving/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=full&geometries=geojson`
            );
            const data = await res.json();
            if (data.routes?.[0]?.geometry?.coordinates) {
              const latlngs = data.routes[0].geometry.coordinates.map(
                ([lon, lat]: [number, number]) => [lat, lon] as [number, number]
              );
              const line = L.polyline(latlngs, lineStyle).addTo(mapInstanceRef.current);
              routeLinesRef.current.push(line);
              return (data.routes[0].distance as number) / 1000; // Meter → km
            }
          } catch {
            const line = L.polyline(
              [[a.latitude, a.longitude], [b.latitude, b.longitude]],
              { ...lineStyle, dashArray: '4 8', opacity: 0.4 }
            ).addTo(mapInstanceRef.current);
            routeLinesRef.current.push(line);
          }
          return null;
        })
      );

      // Nur OSRM-Segmente summieren (null = Fallback auf Luftlinie, kein Einfluss)
      const validDistances = distances.filter((d): d is number => d !== null);
      if (validDistances.length > 0 && onRouteDistance) {
        onRouteDistance(Math.round(validDistances.reduce((s, d) => s + d, 0)));
      }
    });
  }, [posts, isLoaded, interactive, onRouteDistance]);

  // Selection-Marker (Picker-Modus)
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      if (selectionMarkerRef.current) {
        selectionMarkerRef.current.remove();
        selectionMarkerRef.current = null;
      }

      if (selectedLocation) {
        const iconHtml = `
          <div style="
            width: 28px; height: 28px;
            background: #f59e0b;
            border: 3px solid #fef3c7;
            border-radius: 50%;
            box-shadow: 0 0 0 6px rgba(245,158,11,0.3);
          "></div>
        `;
        const icon = L.divIcon({
          html: iconHtml, className: '', iconSize: [28, 28], iconAnchor: [14, 14],
        });
        selectionMarkerRef.current = L.marker(
          [selectedLocation.lat, selectedLocation.lng], { icon }
        ).addTo(mapInstanceRef.current);
      }
    });
  }, [selectedLocation, isLoaded]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full"
      style={{ background: '#0f1712' }}
    />
  );
}
