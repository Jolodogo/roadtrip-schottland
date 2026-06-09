/// <reference lib="webworker" />

// Push-Notification empfangen und anzeigen
self.addEventListener('push', (event: PushEvent) => {
  const data = (event.data?.json() ?? {}) as {
    title?: string;
    body?: string;
    url?: string;
    icon?: string;
  };

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Schottland-Roadtrip 🏴󠁧󠁢󠁳󠁣󠁴󠁿', {
      body: data.body ?? 'Neuer Post veröffentlicht!',
      icon: data.icon ?? '/icon.png',
      badge: '/icon.png',
      data: { url: data.url ?? '/' },
    })
  );
});

// Auf Notification-Klick: App öffnen oder fokussieren
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data as { url?: string })?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
