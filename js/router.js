/* ============================================================
   OLYMPIC APP — ROUTER MODULE
   المسؤول عن التنقل بين الصفحات داخل التطبيق
   ============================================================ */

const Router = (() => {

  /* ──────────────────────────────────────────
     STATE — الحالة الداخلية
     ────────────────────────────────────────── */
  let _currentPage   = null;   // الصفحة الحالية
  let _previousPage  = null;   // الصفحة السابقة
  let _params        = {};     // معاملات الصفحة الحالية
  let _routes        = {};     // سجل المسارات المُسجَّلة
  let _middlewares   = [];     // دوال تُنفَّذ قبل كل تنقل
  let _isTransitioning = false; // منع التنقل المتزامن

  /* ──────────────────────────────────────────
     ELEMENTS — عناصر DOM
     ────────────────────────────────────────── */
  const _getContainer  = () => document.getElementById('page-container');
  const _getBottomNav  = () => document.getElementById('bottom-nav');

  /* ──────────────────────────────────────────
     REGISTER — تسجيل المسارات
     ────────────────────────────────────────── */

  /**
   * تسجيل مسار جديد
   * @param {string}   name     — اسم الصفحة (مثال: 'home')
   * @param {function} renderer — دالة تُعيد HTML string أو تُعدِّل DOM
   * @param {object}   options  — { title, showNav, requireAuth }
   */
  const register = (name, renderer, options = {}) => {
    if (typeof renderer !== 'function') {
      console.error(`[Router] المسار "${name}" يتطلب دالة renderer.`);
      return;
    }

    _routes[name] = {
      name,
      renderer,
      title      : options.title       ?? 'أولمبياد المعرفة',
      showNav    : options.showNav     ?? true,
      requireAuth: options.requireAuth ?? true,
    };

    console.info(`[Router] ✅ تم تسجيل المسار: "${name}"`);
  };

  /* ──────────────────────────────────────────
     MIDDLEWARE — طبقة ما قبل التنقل
     ────────────────────────────────────────── */

  /**
   * إضافة middleware يُنفَّذ قبل كل تنقل
   * @param {function} fn — fn(to, from, params) → true للمتابعة / false للإيقاف
   */
  const use = (fn) => {
    if (typeof fn === 'function') _middlewares.push(fn);
  };

  /**
   * تنفيذ كل الـ middlewares بالترتيب
   * @param {string} to
   * @param {string} from
   * @param {object} params
   * @returns {boolean} — هل يكمل التنقل؟
   */
  const _runMiddlewares = (to, from, params) => {
    for (const fn of _middlewares) {
      try {
        const result = fn(to, from, params);
        if (result === false) return false;
      } catch (err) {
        console.error('[Router] خطأ في middleware:', err);
      }
    }
    return true;
  };

  /* ──────────────────────────────────────────
     NAVIGATE — التنقل الرئيسي
     ────────────────────────────────────────── */

  /**
   * الانتقال إلى صفحة معينة
   * @param {string} pageName — اسم الصفحة المسجّلة
   * @param {object} params   — معاملات إضافية (مثال: { id: 3 })
   * @param {object} options  — { replace: bool, skipMiddleware: bool }
   */
  const navigate = async (pageName, params = {}, options = {}) => {

    // منع التنقل المتزامن
    if (_isTransitioning) return;

    // التحقق من وجود المسار
    const route = _routes[pageName];
    if (!route) {
      console.error(`[Router] المسار "${pageName}" غير مسجّل.`);
      navigate('not-found');
      return;
    }

    // تنفيذ الـ middlewares
    if (!options.skipMiddleware) {
      const canProceed = _runMiddlewares(pageName, _currentPage, params);
      if (!canProceed) return;
    }

    _isTransitioning = true;

    try {
      // تحديث الحالة
      _previousPage = _currentPage;
      _currentPage  = pageName;
      _params       = params;

      // تحديث عنوان الصفحة
      document.title = route.title;

      // تحديث شريط التنقل السفلي
      _updateBottomNav(pageName, route.showNav);

      // تحديث URL hash بدون تحديث الصفحة
      const hash = _buildHash(pageName, params);
      if (!options.replace) {
        history.pushState({ page: pageName, params }, '', hash);
      } else {
        history.replaceState({ page: pageName, params }, '', hash);
      }

      // عرض الصفحة
      await _renderPage(route, params);

      // Scroll للأعلى
      window.scrollTo({ top: 0, behavior: 'smooth' });

      console.info(`[Router] 🔀 انتقل إلى: "${pageName}"`, params);

    } catch (err) {
      console.error(`[Router] خطأ أثناء عرض "${pageName}":`, err);
      _renderError(err);
    } finally {
      _isTransitioning = false;
    }
  };

  /* ──────────────────────────────────────────
     RENDER — عرض الصفحة
     ────────────────────────────────────────── */

  /**
   * استدعاء renderer الخاص بالمسار وحقن HTML
   * @param {object} route
   * @param {object} params
   */
  const _renderPage = async (route, params) => {
    const container = _getContainer();
    if (!container) return;

    // إخفاء المحتوى الحالي
    container.style.opacity = '0';
    container.style.transform = 'translateY(10px)';
    container.style.transition = 'opacity 0.15s ease, transform 0.15s ease';

    await _wait(80);

    // استدعاء الـ renderer
    const result = await Promise.resolve(route.renderer(params));

    // إذا أعاد HTML string → حقنه، وإذا لا → المفروض أن renderer يُعدّل DOM مباشرة
    if (typeof result === 'string') {
      container.innerHTML = result;
    }

    // ظهور بنعومة
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';

    // تسجيل أحداث ما بعد الرسم
    await _wait(50);
    _attachPageEvents(route.name, params);
  };

  /**
   * عرض صفحة خطأ عامة
   * @param {Error} err
   */
  const _renderError = (err) => {
    const container = _getContainer();
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state page">
        <div class="empty-state__icon">⚠️</div>
        <p class="empty-state__title">حدث خطأ</p>
        <p class="empty-state__text">${err.message || 'خطأ غير معروف.'}</p>
        <button class="btn btn--primary mt-md" onclick="Router.navigate('home')">
          العودة للرئيسية
        </button>
      </div>
    `;
    container.style.opacity  = '1';
    container.style.transform = 'translateY(0)';
  };

  /* ──────────────────────────────────────────
     PAGE EVENTS — أحداث ما بعد الرسم
     ────────────────────────────────────────── */

  /**
   * ربط الأحداث الخاصة بكل صفحة بعد حقن HTML
   * @param {string} pageName
   * @param {object} params
   */
  const _attachPageEvents = (pageName, params) => {

    // زر الرجوع (موجود في صفحات التفاصيل)
    document.querySelectorAll('[data-back]').forEach(btn => {
      btn.addEventListener('click', () => back());
    });

    // روابط التنقل الداخلية data-navigate="pageName"
    document.querySelectorAll('[data-navigate]').forEach(el => {
      el.addEventListener('click', () => {
        const target     = el.dataset.navigate;
        const rawParams  = el.dataset.params ? JSON.parse(el.dataset.params) : {};
        navigate(target, rawParams);
      });
    });

    // زر إعادة المحاولة في صفحة التحديثات
    const retryBtn = document.getElementById('btn-retry-updates');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => navigate('updates', {}, { replace: true }));
    }

    // زر إجبار التحديث
    const forceBtn = document.getElementById('btn-force-refresh');
    if (forceBtn) {
      forceBtn.addEventListener('click', async () => {
        Updates.clearCache();
        navigate('updates', {}, { replace: true });
      });
    }

    // تفويض الأحداث لعناصر .card--clickable
    document.querySelectorAll('.card--clickable[data-navigate]').forEach(card => {
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') card.click();
      });
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
    });
  };

  /* ──────────────────────────────────────────
     BOTTOM NAV — تحديث شريط التنقل
     ────────────────────────────────────────── */

  /**
   * تحديث الزر النشط في Bottom Nav
   * @param {string}  pageName
   * @param {boolean} showNav
   */
  const _updateBottomNav = (pageName, showNav) => {
    const nav = _getBottomNav();
    if (!nav) return;

    // إخفاء أو إظهار شريط التنقل
    nav.classList.toggle('hidden', !showNav);

    // تحديد الزر النشط
    nav.querySelectorAll('.bottom-nav__item').forEach(item => {
      const isActive = item.dataset.page === pageName;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  };

  /* ──────────────────────────────────────────
     HASH — إدارة URL
     ────────────────────────────────────────── */

  /**
   * بناء hash URL من اسم الصفحة والمعاملات
   * @param {string} pageName
   * @param {object} params
   * @returns {string}
   */
  const _buildHash = (pageName, params) => {
    const base = `#${pageName}`;
    const keys = Object.keys(params);
    if (keys.length === 0) return base;

    const query = keys
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');

    return `${base}?${query}`;
  };

  /**
   * تحليل hash URL الحالي
   * @returns {{ page: string, params: object }}
   */
  const _parseHash = () => {
    const hash = window.location.hash.slice(1); // إزالة #
    if (!hash) return { page: 'home', params: {} };

    const [pagePart, queryPart] = hash.split('?');
    const page   = pagePart || 'home';
    const params = {};

    if (queryPart) {
      queryPart.split('&').forEach(pair => {
        const [key, val] = pair.split('=');
        if (key) params[decodeURIComponent(key)] = decodeURIComponent(val || '');
      });
    }

    return { page, params };
  };

  /* ──────────────────────────────────────────
     HISTORY — التنقل للأمام والخلف
     ────────────────────────────────────────── */

  /**
   * الرجوع للصفحة السابقة
   */
  const back = () => {
    if (_previousPage && _previousPage !== _currentPage) {
      navigate(_previousPage, {}, { replace: false });
    } else {
      navigate('home', {}, { replace: false });
    }
  };

  /**
   * معالجة زر الرجوع في المتصفح / الجهاز
   */
  const _handlePopState = (event) => {
    if (event.state && event.state.page) {
      navigate(event.state.page, event.state.params || {}, { skipMiddleware: false });
    } else {
      const { page, params } = _parseHash();
      navigate(page, params, { skipMiddleware: false });
    }
  };

  /* ──────────────────────────────────────────
     INIT — تهيئة الراوتر
     ────────────────────────────────────────── */

  /**
   * تهيئة الراوتر وإضافة مستمع popstate
   * @param {string} defaultPage — الصفحة الافتراضية
   */
  const init = (defaultPage = 'home') => {

    // ربط Bottom Nav buttons
    const nav = _getBottomNav();
    if (nav) {
      nav.querySelectorAll('.bottom-nav__item').forEach(btn => {
        btn.addEventListener('click', () => {
          const page = btn.dataset.page;
          if (page && page !== _currentPage) navigate(page);
        });
      });
    }

    // مستمع زر Back في المتصفح
    window.addEventListener('popstate', _handlePopState);

    // قراءة الـ hash الحالي عند التحميل
    const { page, params } = _parseHash();
    const startPage = _routes[page] ? page : defaultPage;

    navigate(startPage, params, { replace: true });

    console.info(`[Router] 🚀 تهيئة الراوتر. الصفحة الافتراضية: "${startPage}"`);
  };

  /* ──────────────────────────────────────────
     UTILITY
     ────────────────────────────────────────── */

  /** انتظار ms ملي ثانية */
  const _wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  /** الصفحة الحالية */
  const getCurrentPage = () => _currentPage;

  /** الصفحة السابقة */
  const getPreviousPage = () => _previousPage;

  /** المعاملات الحالية */
  const getParams = () => ({ ..._params });

  /** هل المسار مسجّل؟ */
  const hasRoute = (name) => name in _routes;

  /* ──────────────────────────────────────────
     PUBLIC API
     ────────────────────────────────────────── */
  return {
    register,
    navigate,
    back,
    use,
    init,
    getCurrentPage,
    getPreviousPage,
    getParams,
    hasRoute,
  };

})();