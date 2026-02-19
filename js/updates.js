/* ============================================================
   OLYMPIC APP — UPDATES MODULE
   المسؤول عن جلب ومقارنة التحديثات من GitHub
   ============================================================ */

const Updates = (() => {

  /* ──────────────────────────────────────────
     CONFIG — الإعدادات
     ────────────────────────────────────────── */
  const CONFIG = {
    // ✏️ ضع هنا رابط ملف updates.json من GitHub Raw
    JSON_URL: 'https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/data/updates.json',

    // مدة الكاش قبل إعادة الجلب (بالمللي ثانية) — 30 دقيقة
    CACHE_DURATION_MS: 30 * 60 * 1000,

    // مفتاح كاش وقت آخر جلب
    LAST_FETCH_KEY: 'olympic_last_fetch_time',

    // مفتاح كاش بيانات التحديث
    CACHED_DATA_KEY: 'olympic_cached_update_data',
  };

  /* ──────────────────────────────────────────
     STATE — الحالة الداخلية
     ────────────────────────────────────────── */
  let _latestData    = null;   // آخر بيانات مجلوبة
  let _hasUpdate     = false;  // هل يوجد تحديث جديد؟
  let _isFetching    = false;  // هل يتم الجلب الآن؟
  let _listeners     = [];     // المستمعون على أحداث التحديث

  /* ──────────────────────────────────────────
     CACHE HELPERS
     ────────────────────────────────────────── */

  /**
   * حفظ بيانات التحديث في الكاش مع وقت الجلب
   * @param {object} data
   */
  const _cacheData = (data) => {
    try {
      localStorage.setItem(CONFIG.CACHED_DATA_KEY, JSON.stringify(data));
      localStorage.setItem(CONFIG.LAST_FETCH_KEY, Date.now().toString());
    } catch (err) {
      console.warn('[Updates] فشل حفظ الكاش:', err);
    }
  };

  /**
   * جلب البيانات من الكاش إذا لم تنتهِ صلاحيته
   * @returns {object|null}
   */
  const _getCachedData = () => {
    try {
      const lastFetch = parseInt(localStorage.getItem(CONFIG.LAST_FETCH_KEY) || '0', 10);
      const now       = Date.now();

      if ((now - lastFetch) > CONFIG.CACHE_DURATION_MS) return null;

      const raw = localStorage.getItem(CONFIG.CACHED_DATA_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  /**
   * مسح كاش التحديثات لإجبار إعادة الجلب
   */
  const _clearCache = () => {
    localStorage.removeItem(CONFIG.CACHED_DATA_KEY);
    localStorage.removeItem(CONFIG.LAST_FETCH_KEY);
  };

  /* ──────────────────────────────────────────
     FETCH — جلب البيانات من الشبكة
     ────────────────────────────────────────── */

  /**
   * جلب ملف updates.json من GitHub
   * @param {boolean} forceRefresh — تجاهل الكاش
   * @returns {Promise<object|null>}
   */
  const fetchUpdates = async (forceRefresh = false) => {
    // منع طلبات متزامنة
    if (_isFetching) return _latestData;

    // محاولة الكاش أولاً
    if (!forceRefresh) {
      const cached = _getCachedData();
      if (cached) {
        console.info('[Updates] تم تحميل البيانات من الكاش.');
        _latestData = cached;
        await _processUpdateData(cached);
        return cached;
      }
    }

    _isFetching = true;
    _notifyListeners({ type: 'loading', payload: true });

    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(CONFIG.JSON_URL, {
        signal: controller.signal,
        cache : 'no-store',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // التحقق من صحة البنية
      if (!_validateSchema(data)) {
        throw new Error('بنية ملف updates.json غير صحيحة.');
      }

      // حفظ في الكاش
      _cacheData(data);
      _latestData = data;

      await _processUpdateData(data);

      console.info('[Updates] تم جلب التحديثات بنجاح. النسخة:', data.version);
      return data;

    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('[Updates] انتهت مهلة الاتصال.');
        _notifyListeners({ type: 'error', payload: 'انتهت مهلة الاتصال.' });
      } else {
        console.warn('[Updates] فشل الجلب:', err.message);
        _notifyListeners({ type: 'error', payload: err.message });
      }

      // العودة للكاش القديم عند الفشل
      const staleCache = _getCachedDataIgnoringExpiry();
      if (staleCache) {
        console.info('[Updates] استخدام الكاش القديم كبديل.');
        _latestData = staleCache;
        await _processUpdateData(staleCache);
        return staleCache;
      }

      return null;

    } finally {
      _isFetching = false;
      _notifyListeners({ type: 'loading', payload: false });
    }
  };

  /**
   * جلب الكاش بغض النظر عن صلاحيته (خط الدفاع الأخير)
   * @returns {object|null}
   */
  const _getCachedDataIgnoringExpiry = () => {
    try {
      const raw = localStorage.getItem(CONFIG.CACHED_DATA_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  /* ──────────────────────────────────────────
     VALIDATION — التحقق من بنية الملف
     ────────────────────────────────────────── */

  /**
   * التحقق من أن ملف JSON يحتوي على الحقول المطلوبة
   * @param {object} data
   * @returns {boolean}
   */
  const _validateSchema = (data) => {
    if (!data || typeof data !== 'object')          return false;
    if (typeof data.version !== 'string')           return false;
    if (typeof data.title   !== 'string')           return false;
    if (!Array.isArray(data.changes))               return false;
    return true;
  };

  /* ──────────────────────────────────────────
     PROCESS — معالجة البيانات بعد الجلب
     ────────────────────────────────────────── */

  /**
   * مقارنة النسخة الجديدة مع المخزنة وإطلاق الأحداث
   * @param {object} data
   */
  const _processUpdateData = async (data) => {
    _hasUpdate = Storage.hasNewVersion(data.version);

    _notifyListeners({
      type   : 'checked',
      payload: {
        hasUpdate  : _hasUpdate,
        latestData : data,
      },
    });

    if (_hasUpdate) {
      _showUpdateBadge();
      console.info('[Updates] يوجد إصدار جديد:', data.version);
    } else {
      _hideUpdateBadge();
      console.info('[Updates] التطبيق محدّث. النسخة الحالية:', data.version);
    }
  };

  /* ──────────────────────────────────────────
     BADGE — شارة الإشعار
     ────────────────────────────────────────── */

  const _showUpdateBadge = () => {
    const badge   = document.getElementById('update-badge');
    const navDot  = document.getElementById('nav-update-dot');
    if (badge)  badge.classList.remove('hidden');
    if (navDot) navDot.classList.remove('hidden');
  };

  const _hideUpdateBadge = () => {
    const badge   = document.getElementById('update-badge');
    const navDot  = document.getElementById('nav-update-dot');
    if (badge)  badge.classList.add('hidden');
    if (navDot) navDot.classList.add('hidden');
  };

  /* ──────────────────────────────────────────
     MARK AS SEEN — تعليم التحديث كمقروء
     ────────────────────────────────────────── */

  /**
   * يُستدعى عندما يفتح المستخدم صفحة التحديثات
   */
  const markCurrentVersionAsSeen = () => {
    if (_latestData && _latestData.version) {
      Storage.saveSeenVersion(_latestData.version);
      _hasUpdate = false;
      _hideUpdateBadge();
      console.info('[Updates] تم تعليم النسخة كمقروءة:', _latestData.version);
    }
  };

  /* ──────────────────────────────────────────
     RENDER — توليد HTML صفحة التحديثات
     ────────────────────────────────────────── */

  /**
   * توليد HTML لعرض صفحة التحديثات
   * @param {object} data — بيانات updates.json
   * @returns {string} HTML
   */
  const renderUpdatesPage = (data) => {
    if (!data) {
      return `
        <div class="empty-state">
          <div class="empty-state__icon">📡</div>
          <p class="empty-state__title">لا يوجد اتصال</p>
          <p class="empty-state__text">
            تعذّر تحميل التحديثات. تحقق من اتصالك بالإنترنت وحاول مجدداً.
          </p>
          <button class="btn btn--primary mt-md" id="btn-retry-updates">
            إعادة المحاولة
          </button>
        </div>
      `;
    }

    const changesList = data.changes.map(change => `
      <li class="update-change-item">
        <span class="update-change-icon">${_getChangeIcon(change.type)}</span>
        <span class="update-change-text">${_escapeHtml(change.text)}</span>
      </li>
    `).join('');

    const lessonsSection = data.newLessons && data.newLessons.length > 0
      ? `
        <div class="update-section mt-md">
          <h3 class="update-section-title">📘 دروس جديدة</h3>
          <ul class="update-items-list">
            ${data.newLessons.map(l => `
              <li class="update-item-pill">
                ${_escapeHtml(l)}
              </li>
            `).join('')}
          </ul>
        </div>
      ` : '';

    const exercisesSection = data.newExercises && data.newExercises.length > 0
      ? `
        <div class="update-section mt-md">
          <h3 class="update-section-title">📝 تمارين جديدة</h3>
          <ul class="update-items-list">
            ${data.newExercises.map(e => `
              <li class="update-item-pill">
                ${_escapeHtml(e)}
              </li>
            `).join('')}
          </ul>
        </div>
      ` : '';

    return `
      <div class="page updates-page">

        <div class="updates-hero">
          <div class="updates-hero__badge">🚀 الإصدار ${_escapeHtml(data.version)}</div>
          <h1 class="updates-hero__title">${_escapeHtml(data.title)}</h1>
          ${data.date ? `<p class="updates-hero__date">📅 ${_escapeHtml(data.date)}</p>` : ''}
          ${data.description
            ? `<p class="updates-hero__desc">${_escapeHtml(data.description)}</p>`
            : ''}
        </div>

        <div class="card mt-md">
          <h2 class="section-title mb-md">ما الجديد؟</h2>
          <ul class="update-changes-list">
            ${changesList}
          </ul>
        </div>

        ${lessonsSection}
        ${exercisesSection}

        <button class="btn btn--outline btn--full mt-md" id="btn-force-refresh">
          🔄 التحقق من تحديثات جديدة
        </button>

      </div>
    `;
  };

  /* ──────────────────────────────────────────
     HELPERS — أدوات مساعدة
     ────────────────────────────────────────── */

  /**
   * أيقونة نوع التغيير
   * @param {'new'|'fix'|'improve'|'remove'} type
   * @returns {string}
   */
  const _getChangeIcon = (type) => {
    const icons = {
      new    : '✨',
      fix    : '🔧',
      improve: '⚡',
      remove : '🗑️',
    };
    return icons[type] || '📌';
  };

  /**
   * تأمين النص ضد XSS
   * @param {string} str
   * @returns {string}
   */
  const _escapeHtml = (str) => {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#039;');
  };

  /* ──────────────────────────────────────────
     EVENT LISTENERS — نظام الأحداث الداخلي
     ────────────────────────────────────────── */

  /**
   * تسجيل مستمع على أحداث Updates
   * @param {function} callback — fn({ type, payload })
   * @returns {function} دالة إلغاء الاشتراك
   */
  const onEvent = (callback) => {
    if (typeof callback !== 'function') return () => {};
    _listeners.push(callback);
    return () => {
      _listeners = _listeners.filter(fn => fn !== callback);
    };
  };

  /**
   * إخطار كل المستمعين بحدث
   * @param {{ type: string, payload: * }} event
   */
  const _notifyListeners = (event) => {
    _listeners.forEach(fn => {
      try { fn(event); } catch (e) { console.error('[Updates] خطأ في المستمع:', e); }
    });
  };

  /* ──────────────────────────────────────────
     GETTERS
     ────────────────────────────────────────── */

  /** هل يوجد تحديث لم يُشاهَد بعد؟ */
  const hasUpdate     = () => _hasUpdate;

  /** آخر بيانات مجلوبة */
  const getLatestData = () => _latestData;

  /** هل يتم الجلب الآن؟ */
  const isFetching    = () => _isFetching;

  /* ──────────────────────────────────────────
     PUBLIC API
     ────────────────────────────────────────── */
  return {
    fetchUpdates,
    markCurrentVersionAsSeen,
    renderUpdatesPage,
    onEvent,
    hasUpdate,
    getLatestData,
    isFetching,
    clearCache: _clearCache,
    escapeHtml: _escapeHtml,

    // للتعديل من الخارج إذا لزم
    setJsonUrl: (url) => { CONFIG.JSON_URL = url; },
  };

})();