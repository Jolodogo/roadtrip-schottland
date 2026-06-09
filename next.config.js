const withPWA = require('@ducanh2912/next-pwa').default;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

module.exports = withPWA({
  dest: 'public',
  // Service Worker im Development deaktivieren (würde Hot Reload stören)
  disable: process.env.NODE_ENV === 'development',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // CartoDB Kacheln: CacheFirst — Tiles ändern sich nie
      {
        urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'map-tiles',
          expiration: {
            maxEntries: 500,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // Supabase Storage Fotos: CacheFirst — Bilder ändern sich nach Upload nicht
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'post-images',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // /api/posts: StaleWhileRevalidate — sofort aus Cache, Hintergrund-Update
      {
        urlPattern: /^https?:\/\/.*\/api\/posts$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'api-posts',
          expiration: {
            maxEntries: 1,
            maxAgeSeconds: 24 * 60 * 60,
          },
        },
      },
    ],
  },
})(nextConfig);
