// =========================================================================
// SERVICE WORKER UNIFIÉ - LIQUIDLIFE PREMIUM (CACHE PWA + ONESIGNAL PUSH)
// =========================================================================

const CACHE_NAME = 'liquidlife-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js'
];

// Installation du Service Worker et mise en cache des ressources critiques
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activation du Service Worker et nettoyage des anciens caches pour libérer l'espace
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Interception des requêtes réseaux avec stratégie Cache-First (sauf pour les services de push)
self.addEventListener('fetch', event => {
  // On ignore systématiquement le cache pour OneSignal et les CDNs externes pour éviter tout blocage
  if (
    event.request.url.includes('onesignal.com') || 
    event.request.url.includes('unpkg.com') || 
    event.request.url.includes('cdnjs.cloudflare.com')
  ) {
    return;
  }
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Gestion native du clic sur les notifications de secours
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Si l'application est déjà ouverte, on la met au premier plan
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        if (client.url.indexOf('/') !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon, on ouvre une nouvelle instance de l'application
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// =========================================================================
// IMPORTATION DU SDK ONESIGNAL V16 POUR LA GESTION DES PUSHS EN ARRIÈRE-PLAN
// =========================================================================
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
