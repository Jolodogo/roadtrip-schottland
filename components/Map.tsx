'use client';

import { useEffect, useRef, useState } from 'react';
import { Post } from '@/lib/types';

interface MapProps {
  posts: Post[];
  onLocationSelect?: (lat: number, lng: number) => void;
  interactive?: boolean; // true = location picker mode
  selectedLocation?: { lat: number; lng: number } | null;
}

export default function Map({
  posts,
  onLocationSelect,
  interactive = false,
  selectedLocation,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLinesRef = useRef<any[]>([]);
  const selectionMarkerRef = useRef<any>(null);
  const initializingRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || initializingRef.current) return;
    initializingRef.current = true;

    // Dynamic import to avoid SSR issues
    import('leaflet').then((L) => {
      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [57.0, -4.2],
        zoom: interactive ? 6 : 6,
        zoomControl: true,
        attributionControl: true,
      });

      // OpenStreetMap tile layer — dark-ish style via CartoDB
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

      // Location picker mode: click to set position
      if (interactive && onLocationSelect) {
        map.on('click', (e: any) => {
          onLocationSelect(e.latlng.lat, e.latlng.lng);
        });
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync posts to markers
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      // Clear old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      posts.forEach((post, index) => {
        const isNewest = index === 0;

        // Custom icon
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

        const dateStr = new Date(post.created_at).toLocaleDateString('de-DE', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        });

        const popupContent = `
          <div style="font-family: Inter, sans-serif; color: #f0f8f0; min-width: 200px;">
            ${post.image_url ? `
              <div style="margin: -1px -1px 0; overflow: hidden; border-radius: 12px 12px 0 0;">
                <img src="${post.image_url}" alt="${post.title}"
                  style="width: 100%; height: 160px; object-fit: cover; display: block;" />
              </div>
            ` : ''}
            <div style="padding: 12px;">
              <div style="font-size: 11px; color: #4ade80; margin-bottom: 4px;">${dateStr}${post.location_name ? ` · ${post.location_name}` : ''}</div>
              <div style="font-size: 15px; font-weight: 600; margin-bottom: 6px; line-height: 1.3;">${post.title}</div>
              ${post.text ? `<div style="font-size: 13px; color: #bbf7d0; line-height: 1.5;">${post.text}</div>` : ''}
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, {
          maxWidth: 280,
          className: 'custom-popup',
        });

        marker.addTo(mapInstanceRef.current);
        markersRef.current.push(marker);
      });

      // Fit map to markers if we have posts and not in picker mode
      if (posts.length > 0 && !interactive) {
        const group = L.featureGroup(markersRef.current);
        mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2), {
          maxZoom: 10,
        });
      }
    });
  }, [posts, isLoaded, interactive]);

  // Straßenroute zwischen Posts (OSRM)
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || interactive) return;
    if (posts.length < 2) return;

    const sorted = [...posts].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    import('leaflet').then(async (L) => {
      // Alte Routen entfernen
      routeLinesRef.current.forEach((l) => l.remove());
      routeLinesRef.current = [];

      const lineStyle = { color: '#16a34a', weight: 3, opacity: 0.7, dashArray: '8 6' };

      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        try {
          const res = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=full&geometries=geojson`
          );
          const data = await res.json();
          if (data.routes?.[0]?.geometry?.coordinates) {
            // OSRM gibt [lon, lat] — Leaflet braucht [lat, lon]
            const latlngs = data.routes[0].geometry.coordinates.map(
              ([lon, lat]: [number, number]) => [lat, lon] as [number, number]
            );
            const line = L.polyline(latlngs, lineStyle).addTo(mapInstanceRef.current);
            routeLinesRef.current.push(line);
          }
        } catch {
          // Fallback: Luftlinie
          const line = L.polyline(
            [[a.latitude, a.longitude], [b.latitude, b.longitude]],
            { ...lineStyle, dashArray: '4 8', opacity: 0.4 }
          ).addTo(mapInstanceRef.current);
          routeLinesRef.current.push(line);
        }
      }
    });
  }, [posts, isLoaded, interactive]);

  // Sync selection marker (picker mode)
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
