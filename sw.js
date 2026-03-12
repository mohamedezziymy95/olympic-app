/* ============================================================
   EQUIPE OLYMPIADE — Lycée Al Wifaq Qualifiant
   Service Worker (sw.js)
   PWA Support + Offline Caching
   ============================================================ */

const CACHE_NAME = 'olympiade-v1.0.0';
const DATA_CACHE_NAME = 'olympiade-data-v1.0.0';

/* ===================== FILES TO CACHE ===================== */
const STATIC_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/notifications.js',
    './data/resources.json',
    './pages/resumes.html',
    './pages/exercices.html',
    './pages/tests.html',
    './pages/documents.html',
    './manifest.json',
];

/* External CDN assets to cache */
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-solid-900.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-regular-400.woff2',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
];

/* ===================== INSTALL EVENT ===================== */
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker:', CACHE_NAME);

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');

                // Cache static assets (fail gracefully for missing files)
                const staticPromises = STATIC_ASSETS.map((url) => {
                    return cache.add(url).catch((err) => {
                        console.warn('[SW] Failed to cache:', url, err.message);
                    });
                });

                // Cache CDN assets (fail gracefully if offline)
                const cdnPromises = CDN_ASSETS.map((url) => {
                    return fetch(url, { mode: 'cors' })
                        .then((response) => {
                            if (response.ok) {
                                return cache.put(url, response);
                            }
                        })
                        .catch((err) => {
                            console.warn('[SW] Failed to cache CDN:', url, err.message);
                        });
                });

                return Promise.all([...staticPromises, ...cdnPromises]);
            })
            .then(() => {
                console.log('[SW] All assets cached successfully');
                // Force activation without waiting
                return self.skipWaiting();
            })
    );
});

/* ===================== ACTIVATE EVENT ===================== */
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker:', CACHE_NAME);

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            // Delete old caches that don't match current version
                            return name !== CACHE_NAME && name !== DATA_CACHE_NAME;
                        })
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Claiming all clients');
                // Take control of all pages immediately
                return self.clients.claim();
            })
    );
});

/* ===================== FETCH EVENT ===================== */
self.addEventListener('fetch', (event) => {
    const requestURL = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip chrome-extension, browser-internal requests
    if (!requestURL.protocol.startsWith('http')) return;

    // Strategy selection based on request type
    if (isResourcesJSON(requestURL)) {
        // resources.json → Network First (always get latest data)
        event.respondWith(networkFirstStrategy(event.request));
    } else if (isFileDownload(requestURL)) {
        // PDF/document downloads → Network First with cache
        event.respondWith(networkFirstStrategy(event.request));
    } else if (isCDNAsset(requestURL)) {
        // CDN assets → Cache First (they rarely change)
        event.respondWith(cacheFirstStrategy(event.request));
    } else if (isGoogleFonts(requestURL)) {
        // Google Fonts → Cache First
        event.respondWith(cacheFirstStrategy(event.request));
    } else {
        // All other static assets → Stale While Revalidate
        event.respondWith(staleWhileRevalidateStrategy(event.request));
    }
});

/* ===================== CACHING STRATEGIES ===================== */

/**
 * Network First Strategy
 * Try network first, fall back to cache if offline
 * Best for: dynamic data (resources.json), file downloads
 */
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            // Clone and cache the fresh response
            const cache = await caches.open(DATA_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);

        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // If it's a page navigation, return offline page
        if (request.headers.get('Accept') && request.headers.get('Accept').includes('text/html')) {
            return createOfflinePage();
        }

        // Return generic error response
        return new Response('Offline - Resource not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
        });
    }
}

/**
 * Cache First Strategy
 * Serve from cache first, only fetch from network if not cached
 * Best for: CDN assets, fonts, images that rarely change
 */
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.warn('[SW] Cache First - both failed:', request.url);

        return new Response('', {
            status: 408,
            statusText: 'Request Timeout',
        });
    }
}

/**
 * Stale While Revalidate Strategy
 * Serve cached version immediately, then update cache in background
 * Best for: static HTML, CSS, JS files
 */
async function staleWhileRevalidateStrategy(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    // Fetch fresh version in background
    const fetchPromise = fetch(request)
        .then((networkResponse) => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch((error) => {
            console.log('[SW] Stale While Revalidate - network failed:', request.url);
            return null;
        });

    // Return cached version immediately, or wait for network
    if (cachedResponse) {
        return cachedResponse;
    }

    const networkResponse = await fetchPromise;

    if (networkResponse) {
        return networkResponse;
    }

    // Last resort for navigation requests
    if (request.headers.get('Accept') && request.headers.get('Accept').includes('text/html')) {
        return createOfflinePage();
    }

    return new Response('', { status: 408 });
}

/* ===================== REQUEST TYPE CHECKS ===================== */

function isResourcesJSON(url) {
    return url.pathname.includes('resources.json');
}

function isFileDownload(url) {
    const path = url.pathname.toLowerCase();
    return path.includes('/files/') ||
           path.endsWith('.pdf') ||
           path.endsWith('.doc') ||
           path.endsWith('.docx') ||
           path.endsWith('.ppt') ||
           path.endsWith('.pptx') ||
           path.endsWith('.xls') ||
           path.endsWith('.xlsx');
}

function isCDNAsset(url) {
    return url.hostname === 'cdnjs.cloudflare.com';
}

function isGoogleFonts(url) {
    return url.hostname === 'fonts.googleapis.com' ||
           url.hostname === 'fonts.gstatic.com';
}

/* ===================== OFFLINE PAGE ===================== */

function createOfflinePage() {
    const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hors connexion — Equipe Olympiade</title>
        <style>
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }

            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f0f4f8;
                color: #0f172a;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 24px;
                text-align: center;
            }

            .offline-container {
                max-width: 400px;
                width: 100%;
            }

            .offline-icon {
                width: 100px;
                height: 100px;
                border-radius: 50%;
                background: linear-gradient(135deg, #1a73e8 0%, #6c63ff 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 28px;
                box-shadow: 0 8px 24px rgba(26, 115, 232, 0.3);
                animation: pulse-icon 2s ease-in-out infinite;
            }

            .offline-icon svg {
                width: 48px;
                height: 48px;
                fill: #ffffff;
            }

            @keyframes pulse-icon {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }

            h1 {
                font-size: 1.5rem;
                font-weight: 800;
                margin-bottom: 10px;
                letter-spacing: -0.3px;
            }

            p {
                font-size: 0.92rem;
                color: #475569;
                line-height: 1.6;
                margin-bottom: 28px;
            }

            .retry-btn {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 14px 32px;
                background: linear-gradient(135deg, #1a73e8 0%, #6c63ff 100%);
                color: #ffffff;
                border: none;
                border-radius: 12px;
                font-size: 0.95rem;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 4px 14px rgba(26, 115, 232, 0.3);
                transition: all 0.25s ease;
                font-family: inherit;
            }

            .retry-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(26, 115, 232, 0.4);
            }

            .retry-btn:active {
                transform: scale(0.97);
            }

            .retry-btn svg {
                width: 18px;
                height: 18px;
                fill: #ffffff;
            }

            .tips {
                margin-top: 36px;
                padding: 18px;
                background: #ffffff;
                border-radius: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                text-align: left;
            }

            .tips h3 {
                font-size: 0.85rem;
                font-weight: 700;
                margin-bottom: 10px;
                color: #0f172a;
            }

            .tips ul {
                list-style: none;
                padding: 0;
            }

            .tips li {
                font-size: 0.8rem;
                color: #475569;
                padding: 5px 0;
                display: flex;
                align-items: flex-start;
                gap: 8px;
                line-height: 1.4;
            }

            .tips li::before {
                content: '•';
                color: #1a73e8;
                font-weight: bold;
                flex-shrink: 0;
                margin-top: 1px;
            }

            .brand {
                margin-top: 32px;
                font-size: 0.75rem;
                color: #94a3b8;
                font-weight: 500;
            }

            @media (prefers-color-scheme: dark) {
                body {
                    background: #0c1222;
                    color: #f1f5f9;
                }
                .tips {
                    background: #151d30;
                }
                .tips h3 { color: #f1f5f9; }
                .tips li { color: #94a3b8; }
            }
        </style>
    </head>
    <body>
        <div class="offline-container">
            <div class="offline-icon">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 8.98C20.93 5.9 16.69 4 12 4C10.14 4 8.36 4.34 6.72 4.96L9.05 7.29C9.97 7.1 10.97 7 12 7c3.53 0 6.71 1.22 9.21 3.22L24 8.98zM4.41 3L3 4.41l2.96 2.96C3.3 9.08 1.31 11.15 0 13.55l2.79 1.24c1.03-1.88 2.58-3.49 4.47-4.63l2.47 2.47C8.09 13.43 6.72 14.59 5.76 16.02L8.55 17.26c.68-1.01 1.64-1.87 2.79-2.43l9.25 9.25L22 22.59 4.41 3zM12 17c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
            </div>

            <h1>Pas de connexion</h1>
            <p>
                Vous êtes actuellement hors ligne. Vérifiez votre connexion internet
                et réessayez pour accéder à vos ressources.
            </p>

            <button class="retry-btn" onclick="location.reload()">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
                Réessayer
            </button>

            <div class="tips">
                <h3>💡 En attendant :</h3>
                <ul>
                    <li>Les documents déjà téléchargés sont disponibles dans votre appareil</li>
                    <li>Vérifiez votre connexion Wi-Fi ou données mobiles</li>
                    <li>Essayez de vous rapprocher de votre routeur Wi-Fi</li>
                    <li>Désactivez puis réactivez le mode avion</li>
                </ul>
            </div>

            <p class="brand">⚛️ Equipe Olympiade — Lycée Al Wifaq</p>
        </div>
    </body>
    </html>
    `;

    return new Response(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=UTF-8',
            'Cache-Control': 'no-cache',
        },
    });
}

/* ===================== PUSH NOTIFICATIONS ===================== */

/**
 * Handle push notification events from server (future use)
 */
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');

    let data = {
        title: '📚 Equipe Olympiade',
        body: 'Nouvelles ressources disponibles !',
        icon: './icons/icon-192.png',
        badge: './icons/icon-72.png',
        tag: 'olympiade-push',
    };

    // Try to parse push data
    if (event.data) {
        try {
            const pushData = event.data.json();
            data = { ...data, ...pushData };
        } catch (e) {
            try {
                data.body = event.data.text();
            } catch (e2) {
                console.warn('[SW] Could not parse push data');
            }
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || './icons/icon-192.png',
        badge: data.badge || './icons/icon-72.png',
        tag: data.tag || 'olympiade-push',
        vibrate: [100, 50, 100],
        renotify: true,
        requireInteraction: false,
        dir: 'ltr',
        lang: 'fr',
        actions: [
            {
                action: 'open',
                title: 'Ouvrir',
            },
            {
                action: 'dismiss',
                title: 'Fermer',
            },
        ],
        data: {
            url: data.url || './',
            timestamp: Date.now(),
        },
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

/* ===================== NOTIFICATION CLICK ===================== */

self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.action);

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    // Open or focus the app
    const targetURL = (event.notification.data && event.notification.data.url) || './';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If app is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes('olympic-app') && 'focus' in client) {
                        client.navigate(targetURL);
                        return client.focus();
                    }
                }

                // Otherwise open a new window
                if (clients.openWindow) {
                    return clients.openWindow(targetURL);
                }
            })
    );
});

/* ===================== NOTIFICATION CLOSE ===================== */

self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed');
});

/* ===================== MESSAGE HANDLER ===================== */

/**
 * Handle messages from the main app
 * Used for cache management and updates
 */
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    if (!event.data) return;

    switch (event.data.type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;

        case 'CLEAR_CACHE':
            clearAllCaches().then(() => {
                event.ports[0]?.postMessage({ type: 'CACHE_CLEARED' });
            });
            break;

        case 'CACHE_FILE':
            if (event.data.url) {
                cacheFile(event.data.url).then(() => {
                    event.ports[0]?.postMessage({
                        type: 'FILE_CACHED',
                        url: event.data.url,
                    });
                });
            }
            break;

        case 'GET_CACHE_SIZE':
            getCacheSize().then((size) => {
                event.ports[0]?.postMessage({
                    type: 'CACHE_SIZE',
                    size: size,
                });
            });
            break;

        case 'UPDATE_RESOURCES':
            updateResourcesCache().then(() => {
                event.ports[0]?.postMessage({ type: 'RESOURCES_UPDATED' });
            });
            break;

        default:
            console.log('[SW] Unknown message type:', event.data.type);
    }
});

/* ===================== CACHE UTILITY FUNCTIONS ===================== */

/**
 * Clear all caches
 */
async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log('[SW] All caches cleared');
}

/**
 * Cache a specific file
 */
async function cacheFile(url) {
    try {
        const cache = await caches.open(DATA_CACHE_NAME);
        const response = await fetch(url);
        if (response.ok) {
            await cache.put(url, response);
            console.log('[SW] Cached file:', url);
        }
    } catch (error) {
        console.warn('[SW] Failed to cache file:', url, error);
    }
}

/**
 * Get total cache size (approximate)
 */
async function getCacheSize() {
    let totalSize = 0;

    const cacheNames = await caches.keys();

    for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();

        for (const request of keys) {
            const response = await cache.match(request);
            if (response) {
                const blob = await response.clone().blob();
                totalSize += blob.size;
            }
        }
    }

    return totalSize;
}

/**
 * Force update the resources.json cache
 */
async function updateResourcesCache() {
    try {
        const cache = await caches.open(DATA_CACHE_NAME);
        const cacheBuster = `?v=${Date.now()}`;

        const response = await fetch('./data/resources.json' + cacheBuster);

        if (response.ok) {
            // Store without cache buster in the URL
            await cache.put('./data/resources.json', response);
            console.log('[SW] Resources cache updated');
        }
    } catch (error) {
        console.warn('[SW] Failed to update resources cache:', error);
    }
}

/* ===================== BACKGROUND SYNC ===================== */

/**
 * Background sync support (future use)
 * Can be used to sync downloaded file tracking
 */
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync event:', event.tag);

    if (event.tag === 'sync-resources') {
        event.waitUntil(updateResourcesCache());
    }
});

/* ===================== PERIODIC SYNC ===================== */

/**
 * Periodic background sync (limited browser support)
 * Automatically checks for new resources
 */
self.addEventListener('periodicsync', (event) => {
    console.log('[SW] Periodic sync event:', event.tag);

    if (event.tag === 'check-new-resources') {
        event.waitUntil(
            updateResourcesCache()
                .then(() => checkForNewResources())
        );
    }
});

/**
 * Check for new resources and notify
 */
async function checkForNewResources() {
    try {
        const response = await fetch('./data/resources.json?v=' + Date.now());

        if (!response.ok) return;

        const data = await response.json();
        const categories = ['resumes', 'exercices', 'tests', 'documents'];
        let totalFiles = 0;

        categories.forEach((cat) => {
            if (data[cat] && Array.isArray(data[cat])) {
                totalFiles += data[cat].length;
            }
        });

        console.log('[SW] Resources check complete. Total files:', totalFiles);
    } catch (error) {
        console.warn('[SW] Failed to check for new resources:', error);
    }
}

console.log('[SW] Service Worker script loaded:', CACHE_NAME);