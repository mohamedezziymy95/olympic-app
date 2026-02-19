/* ============================================================
   OLYMPIC APP — SERVICE WORKER
   المسؤول عن التخزين المؤقت والعمل بدون إنترنت (Offline)
   ============================================================ */

/* ──────────────────────────────────────────
   1. CONFIG — الإعدادات
   ────────────────────────────────────────── */

const SW_VERSION    = '1.0.0';
const CACHE_PREFIX  = 'olympic-app';
const STATIC_CACHE  = `${CACHE_PREFIX}-static-v${SW_VERSION}`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}-dynamic-v${SW_VERSION}`;
const IMAGE_CACHE   = `${CACHE_PREFIX}-images-v${SW_VERSION}`;

// الحد الأقصى لعدد الملفات في الكاش الديناميكي
const DYNAMIC_CACHE_LIMIT = 50;
const IMAGE_CACHE_LIMIT   = 30;

/* ──────────────────────────────────────────
   2. STATIC ASSETS — الملفات الثابتة
   ────────────────────────────────────────── */

const STATIC_ASSETS = [
  './',
  './index.html',
  './register.html',
  './manifest.json',
  './css/main.css',
  './js/storage.js',
  './js/updates.js',
  './js/router.js',
  './js/app.js',
  './assets/icons/icon-72.png',
  './assets/icons/icon-96.png',
  './assets/icons/icon-128.png',
  './assets/icons/icon-144.png',
  './assets/icons/icon-152.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-384.png',
  './assets/icons/icon-512.png',
];

// الصفحة البديلة عند عدم الاتصال
const OFFLINE_PAGE = './index.html';

/* ──────────────────────────────────────────
   3. HELPERS — دوال مساعدة
   ────────────────────────────────────────── */

/**
 * تقليص حجم الكاش عند تجاوز الحد الأقصى
 * @param {string} cacheName
 * @param {number} maxItems
 */
const trimCache = async (cacheName, maxItems) => {
  const cache = await caches.open(cacheName);
  const keys  = await cache.keys();

  if (keys.length > maxItems) {
    // حذف الأقدم أولاً (FIFO)
    const deleteCount = keys.length - maxItems;
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i]);
    }
    console.info(`[SW] 🗑️ حذف ${deleteCount} عنصر من "${cacheName}"`);
  }
};

/**
 * هل الطلب يخص صورة؟
 * @param {Request} request
 * @returns {boolean}
 */
const isImageRequest = (request) => {
  const url = request.url;
  return /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url);
};

/**
 * هل الطلب يخص API خارجي أو ملف JSON؟
 * @param {Request} request
 * @returns {boolean}
 */
const isApiRequest = (request) => {
  return request.url.includes('raw.githubusercontent.com') ||
         request.url.includes('/data/');
};

/**
 * هل الطلب يخص ملفات ثابتة؟
 * @param {Request} request
 * @returns {boolean}
 */
const isStaticAsset = (request) => {
  const url = new URL(request.url);
  return STATIC_ASSETS.some(asset => {
    const assetPath = asset.replace('./', '');
    return url.pathname.endsWith(assetPath) || url.pathname === '/' + assetPath;
  });
};

/* ──────────────────────────────────────────
   4. INSTALL EVENT — التثبيت
   ────────────────────────────────────────── */

self.addEventListener('install', (event) => {
  console.info(`[SW] 📦 تثبيت Service Worker v${SW_VERSION}`);

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.info('[SW] ⬇️ تخزين الملفات الثابتة...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.info('[SW] ✅ تم تخزين جميع الملفات الثابتة.');
        // تفعيل فوري بدون انتظار إغلاق التبويبات القديمة
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] ❌ فشل التثبيت:', err);
      })
  );
});

/* ──────────────────────────────────────────
   5. ACTIVATE EVENT — التفعيل
   ────────────────────────────────────────── */

self.addEventListener('activate', (event) => {
  console.info(`[SW] ⚡ تفعيل Service Worker v${SW_VERSION}`);

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => {
              // حذف الكاشات القديمة فقط (التي تبدأ بنفس البادئة لكن بنسخة مختلفة)
              return name.startsWith(CACHE_PREFIX) &&
                     name !== STATIC_CACHE &&
                     name !== DYNAMIC_CACHE &&
                     name !== IMAGE_CACHE;
            })
            .map(name => {
              console.info(`[SW] 🗑️ حذف كاش قديم: "${name}"`);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.info('[SW] ✅ تم تنظيف الكاشات القديمة.');
        // التحكم في كل الصفحات المفتوحة فوراً
        return self.clients.claim();
      })
  );
});

/* ──────────────────────────────────────────
   6. FETCH EVENT — اعتراض الطلبات
   ────────────────────────────────────────── */

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // تجاهل الطلبات غير GET
  if (request.method !== 'GET') return;

  // تجاهل طلبات chrome-extension وغيرها
  if (!request.url.startsWith('http')) return;

  /* ─── استراتيجية حسب نوع الطلب ─── */

  // 1) طلبات API / JSON → Network First
  if (isApiRequest(request)) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // 2) طلبات الصور → Cache First
  if (isImageRequest(request)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // 3) ملفات ثابتة → Cache First
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 4) باقي الطلبات → Stale While Revalidate
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});

/* ──────────────────────────────────────────
   7. CACHING STRATEGIES — استراتيجيات التخزين
   ────────────────────────────────────────── */

/**
 * Cache First — الكاش أولاً، ثم الشبكة
 * مناسب للملفات الثابتة التي لا تتغير كثيراً
 */
async function cacheFirst(request, cacheName) {
  try {
    const cache    = await caches.open(cacheName);
    const cached   = await cache.match(request);

    if (cached) {
      return cached;
    }

    const response = await fetch(request);

    if (response && response.status === 200 && response.type === 'basic') {
      const clone = response.clone();
      cache.put(request, clone);

      // تقليص الكاش إذا لزم
      if (cacheName === IMAGE_CACHE) {
        await trimCache(IMAGE_CACHE, IMAGE_CACHE_LIMIT);
      }
    }

    return response;

  } catch (err) {
    console.warn('[SW] ⚠️ Cache First فشل:', request.url);

    // إذا كان طلب صفحة HTML → إرجاع الصفحة البديلة
    if (request.headers.get('accept')?.includes('text/html')) {
      const fallback = await caches.match(OFFLINE_PAGE);
      if (fallback) return fallback;
    }

    // إرجاع استجابة فارغة
    return new Response('', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Network First — الشبكة أولاً، ثم الكاش
 * مناسب لملفات JSON والبيانات المتغيرة
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);

    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      const clone = response.clone();
      cache.put(request, clone);
      await trimCache(cacheName, DYNAMIC_CACHE_LIMIT);
    }

    return response;

  } catch (err) {
    console.warn('[SW] 🔄 Network First fallback إلى الكاش:', request.url);

    const cached = await caches.match(request);
    if (cached) return cached;

    // إذا كان طلب JSON → إرجاع JSON فارغ
    if (request.url.endsWith('.json')) {
      return new Response(
        JSON.stringify({ error: 'offline', message: 'لا يوجد اتصال بالإنترنت' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response('', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Stale While Revalidate — الكاش فوراً + تحديث في الخلفية
 * مناسب للملفات شبه الثابتة
 */
async function staleWhileRevalidate(request, cacheName) {
  try {
    const cache  = await caches.open(cacheName);
    const cached = await cache.match(request);

    // جلب من الشبكة في الخلفية
    const fetchPromise = fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
          trimCache(cacheName, DYNAMIC_CACHE_LIMIT);
        }
        return response;
      })
      .catch(() => null);

    // إرجاع الكاش فوراً إذا وُجد
    if (cached) return cached;

    // إذا لم يوجد كاش → انتظار الشبكة
    const networkResponse = await fetchPromise;

    if (networkResponse) return networkResponse;

    // آخر محاولة → الصفحة البديلة
    if (request.headers.get('accept')?.includes('text/html')) {
      const fallback = await caches.match(OFFLINE_PAGE);
      if (fallback) return fallback;
    }

    return new Response('', {
      status: 503,
      statusText: 'Service Unavailable',
    });

  } catch (err) {
    console.warn('[SW] ⚠️ SWR فشل:', request.url);
    return new Response('', { status: 503 });
  }
}

/* ──────────────────────────────────────────
   8. MESSAGE EVENT — رسائل من التطبيق
   ────────────────────────────────────────── */

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {

    // إعادة تخزين الملفات الثابتة يدوياً
    case 'PRECACHE':
      console.info('[SW] 📦 إعادة تخزين الملفات الثابتة...');
      event.waitUntil(
        caches.open(STATIC_CACHE)
          .then(cache => cache.addAll(STATIC_ASSETS))
          .then(() => {
            console.info('[SW] ✅ تم إعادة التخزين.');
            _notifyClients({ type: 'PRECACHE_DONE' });
          })
      );
      break;

    // مسح كل الكاشات
    case 'CLEAR_CACHE':
      console.info('[SW] 🗑️ مسح جميع الكاشات...');
      event.waitUntil(
        caches.keys()
          .then(names => Promise.all(names.map(name => caches.delete(name))))
          .then(() => {
            console.info('[SW] ✅ تم مسح جميع الكاشات.');
            _notifyClients({ type: 'CACHE_CLEARED' });
          })
      );
      break;

    // جلب حجم الكاش
    case 'GET_CACHE_SIZE':
      event.waitUntil(
        _getCacheSize().then(size => {
          _notifyClients({ type: 'CACHE_SIZE', payload: size });
        })
      );
      break;

    // تخطي الانتظار وتفعيل فوري
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    default:
      console.warn('[SW] رسالة غير معروفة:', type);
  }
});

/* ──────────────────────────────────────────
   9. PUSH NOTIFICATION (جاهز للمستقبل)
   ────────────────────────────────────────── */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = {
      title: 'أولمبياد المعرفة',
      body : event.data.text(),
      icon : './assets/icons/icon-192.png',
    };
  }

  const options = {
    body   : data.body    || 'لديك إشعار جديد',
    icon   : data.icon    || './assets/icons/icon-192.png',
    badge  : data.badge   || './assets/icons/icon-72.png',
    tag    : data.tag     || 'olympic-notification',
    vibrate: [100, 50, 100],
    data   : {
      url: data.url || './index.html',
    },
    actions: data.actions || [
      { action: 'open', title: 'فتح التطبيق' },
      { action: 'close', title: 'إغلاق' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'أولمبياد المعرفة', options)
  );
});

/* ──────────────────────────────────────────
   10. NOTIFICATION CLICK — النقر على الإشعار
   ────────────────────────────────────────── */

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || './index.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // إذا كان التطبيق مفتوحاً → نركز عليه
        for (const client of clientList) {
          if (client.url.includes('index.html') && 'focus' in client) {
            return client.focus();
          }
        }
        // فتح نافذة جديدة
        return self.clients.openWindow(targetUrl);
      })
  );
});

/* ──────────────────────────────────────────
   11. UTILITY — أدوات
   ────────────────────────────────────────── */

/**
 * إرسال رسالة لجميع التبويبات المفتوحة
 * @param {object} message
 */
async function _notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage(message));
}

/**
 * حساب حجم الكاش الإجمالي
 * @returns {Promise<string>}
 */
async function _getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;

  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys  = await cache.keys();

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.clone().blob();
        totalSize += blob.size;
      }
    }
  }

  // تحويل إلى وحدة مقروءة
  if (totalSize < 1024)        return totalSize + ' B';
  if (totalSize < 1048576)     return (totalSize / 1024).toFixed(2) + ' KB';
  return (totalSize / 1048576).toFixed(2) + ' MB';
}

console.info(`[SW] 🏁 Service Worker v${SW_VERSION} محمّل.`);