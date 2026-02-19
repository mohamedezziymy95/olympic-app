/* ============================================================
   OLYMPIC APP — MAIN APPLICATION
   الملف الرئيسي الذي يربط كل الموديولات ويُهيّئ التطبيق
   ============================================================ */

const App = (() => {

  /* ──────────────────────────────────────────
     CONFIG — إعدادات التطبيق
     ────────────────────────────────────────── */
  const CONFIG = {
    WHATSAPP_NUMBER: '212609583996', // ✏️ ضع رقم الواتساب هنا (بدون + أو 00)
    SPLASH_DURATION: 1800,           // مدة عرض Splash Screen
    APP_VERSION    : '1.0.0',
  };

  /* ──────────────────────────────────────────
     DOM ELEMENTS
     ────────────────────────────────────────── */
  const $  = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  const DOM = {
    splash       : () => $('#splash-screen'),
    app          : () => $('#app'),
    pageContainer: () => $('#page-container'),
    modalOverlay : () => $('#modal-overlay'),
    modalContent : () => $('#modal-content'),
    modalClose   : () => $('#modal-close'),
    toast        : () => $('#toast'),
    btnUpdates   : () => $('#btn-updates'),
    btnProfile   : () => $('#btn-profile'),
  };

  /* ──────────────────────────────────────────
     DATA — بيانات التطبيق (مؤقتاً هنا، لاحقاً من JSON)
     ────────────────────────────────────────── */
  const DATA = {
    lessons: [
      {
        id: 1,
        title: 'مقدمة في الرياضيات الأولمبية',
        description: 'تعرّف على أساسيات حل المسائل الأولمبية',
        icon: '📐',
        category: 'رياضيات',
        duration: '15 دقيقة',
        content: `
          <h3>مرحباً بك في الرياضيات الأولمبية</h3>
          <p>الرياضيات الأولمبية هي فرع متقدم من الرياضيات يركز على حل المسائل الإبداعية التي تتطلب تفكيراً عميقاً ومهارات تحليلية متقدمة.</p>
          <h4>المحاور الأساسية:</h4>
          <ul>
            <li>نظرية الأعداد</li>
            <li>الهندسة المستوية</li>
            <li>الجبر المتقدم</li>
            <li>التوافقيات والاحتمالات</li>
          </ul>
          <h4>نصائح للنجاح:</h4>
          <ol>
            <li>تدرب يومياً على المسائل</li>
            <li>ابدأ بالمسائل السهلة ثم تدرج</li>
            <li>راجع الحلول النموذجية</li>
            <li>شارك في المنافسات المحلية</li>
          </ol>
        `,
      },
       {
  id: 4,
  title: 'عنوان الدرس الجديد',
  description: 'وصف قصير',
  icon: '📘',
  category: 'رياضيات',
  duration: '20 دقيقة',
  content: `<h3>المحتوى هنا...</h3><p>...</p>`,
},
      {
        id: 2,
        title: 'نظرية الأعداد - الجزء الأول',
        description: 'القسمة والباقي والأعداد الأولية',
        icon: '🔢',
        category: 'رياضيات',
        duration: '20 دقيقة',
        content: `
          <h3>نظرية الأعداد</h3>
          <p>نظرية الأعداد هي أحد أهم فروع الرياضيات الأولمبية وتدرس خصائص الأعداد الصحيحة.</p>
          <h4>المفاهيم الأساسية:</h4>
          <ul>
            <li><strong>القسمة:</strong> نقول أن a يقسم b إذا وُجد عدد صحيح k بحيث b = a × k</li>
            <li><strong>الأعداد الأولية:</strong> هي الأعداد الأكبر من 1 التي لا تقبل القسمة إلا على 1 وعلى نفسها</li>
            <li><strong>القاسم المشترك الأكبر (GCD):</strong> أكبر عدد يقسم عددين معاً</li>
          </ul>
          <h4>مثال:</h4>
          <p>جد GCD(48, 18):</p>
          <p>48 = 2 × 18 + 12</p>
          <p>18 = 1 × 12 + 6</p>
          <p>12 = 2 × 6 + 0</p>
          <p>إذن GCD = 6</p>
        `,
      },
      {
        id: 3,
        title: 'أساسيات الهندسة المستوية',
        description: 'المثلثات والدوائر والزوايا',
        icon: '📏',
        category: 'هندسة',
        duration: '25 دقيقة',
        content: `
          <h3>الهندسة المستوية</h3>
          <p>الهندسة المستوية تدرس الأشكال الهندسية في البُعدين.</p>
          <h4>خصائص المثلث:</h4>
          <ul>
            <li>مجموع زوايا المثلث = 180°</li>
            <li>الزاوية الخارجية = مجموع الزاويتين الداخليتين غير المجاورتين</li>
            <li>في مثلث قائم: مربع الوتر = مجموع مربعي الضلعين (فيثاغورس)</li>
          </ul>
          <h4>خصائص الدائرة:</h4>
          <ul>
            <li>الزاوية المركزية = ضعف الزاوية المحيطية</li>
            <li>زوايا محيطية على نفس القوس متساوية</li>
          </ul>
        `,
      },
    ],

    exercises: [
      {
        id: 1,
        title: 'تمرين 1: القسمة والباقي',
        description: 'أوجد باقي قسمة عدد كبير',
        icon: '✏️',
        difficulty: 'سهل',
        points: 10,
        question: `
          <p>أوجد باقي قسمة العدد <strong>2^100</strong> على <strong>7</strong>.</p>
          <p><em>تلميح: استخدم نظرية فيرما الصغرى أو ابحث عن النمط الدوري.</em></p>
        `,
      },
       {
  id: 5,
  title: 'تمرين 5: العنوان',
  description: 'وصف قصير',
  icon: '✏️',
  difficulty: 'متوسط',
  points: 20,
  question: `<p>نص التمرين هنا...</p>`,
},
      {
        id: 2,
        title: 'تمرين 2: مسألة هندسية',
        description: 'إثبات تساوي زاويتين في مثلث',
        icon: '📐',
        difficulty: 'متوسط',
        points: 20,
        question: `
          <p>في المثلث ABC، لتكن D نقطة على الضلع BC بحيث AD منصف الزاوية A.</p>
          <p>أثبت أن: <strong>BD/DC = AB/AC</strong></p>
        `,
      },
      {
        id: 3,
        title: 'تمرين 3: الأعداد الأولية',
        description: 'أوجد جميع الأعداد الأولية',
        icon: '🔢',
        difficulty: 'سهل',
        points: 15,
        question: `
          <p>أوجد جميع الأعداد الأولية <strong>p</strong> بحيث يكون <strong>p² + 2</strong> عدداً أولياً أيضاً.</p>
        `,
      },
      {
        id: 4,
        title: 'تمرين 4: نظام المعادلات',
        description: 'حل نظام معادلات بثلاثة مجاهيل',
        icon: '🧮',
        difficulty: 'صعب',
        points: 30,
        question: `
          <p>حل نظام المعادلات التالي في مجموعة الأعداد الحقيقية:</p>
          <ul style="list-style: none; padding: 0;">
            <li>x + y + z = 6</li>
            <li>x² + y² + z² = 14</li>
            <li>x³ + y³ + z³ = 36</li>
          </ul>
        `,
      },
    ],
  };

  /* ──────────────────────────────────────────
     PAGES — تعريف صفحات التطبيق
     ────────────────────────────────────────── */

  /**
   * الصفحة الرئيسية
   */
  const renderHome = () => {
    const student    = Storage.getStudent();
    const lessons    = DATA.lessons;
    const exercises  = DATA.exercises;
    const submitted  = Storage.getSubmittedList();

    return `
      <div class="page home-page">

        <!-- Hero Banner -->
        <div class="hero">
          <p class="hero__greeting">مرحباً بك 👋</p>
          <h1 class="hero__name">${_escapeHtml(student?.fullName || 'ضيف')}</h1>
          <p class="hero__meta">${_escapeHtml(student?.level || '')} ${student?.school ? '• ' + _escapeHtml(student.school) : ''}</p>
        </div>

        <!-- Stats Row -->
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-card__value">${lessons.length}</div>
            <div class="stat-card__label">درس متاح</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__value">${exercises.length}</div>
            <div class="stat-card__label">تمرين</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__value">${submitted.length}</div>
            <div class="stat-card__label">تم إرساله</div>
          </div>
        </div>

        <!-- Recent Lessons -->
        <div class="section-header">
          <h2 class="section-title">آخر الدروس</h2>
          <button class="section-link" data-navigate="lessons">عرض الكل</button>
        </div>

        <div class="grid grid--1">
          ${lessons.slice(0, 2).map(lesson => `
            <div class="card card--clickable" data-navigate="lesson-detail" data-params='{"id": ${lesson.id}}'>
              <div class="card__header">
                <div>
                  <h3 class="card__title">${_escapeHtml(lesson.title)}</h3>
                  <p class="card__subtitle">${_escapeHtml(lesson.description)}</p>
                </div>
                <div class="card__icon card__icon--blue">${lesson.icon}</div>
              </div>
              <span class="card__tag card__tag--primary">${_escapeHtml(lesson.category)}</span>
            </div>
          `).join('')}
        </div>

        <!-- Recent Exercises -->
        <div class="section-header mt-lg">
          <h2 class="section-title">آخر التمارين</h2>
          <button class="section-link" data-navigate="exercises">عرض الكل</button>
        </div>

        <div class="grid grid--1">
          ${exercises.slice(0, 2).map(ex => `
            <div class="card card--clickable" data-navigate="exercise-detail" data-params='{"id": ${ex.id}}'>
              <div class="card__header">
                <div>
                  <h3 class="card__title">${_escapeHtml(ex.title)}</h3>
                  <p class="card__subtitle">${_escapeHtml(ex.description)}</p>
                </div>
                <div class="card__icon card__icon--green">${ex.icon}</div>
              </div>
              <div class="flex items-center gap-sm">
                <span class="card__tag ${_getDifficultyClass(ex.difficulty)}">${_escapeHtml(ex.difficulty)}</span>
                ${Storage.isSubmitted(ex.id) ? '<span class="card__tag card__tag--success">✓ تم الإرسال</span>' : ''}
              </div>
            </div>
          `).join('')}
        </div>

      </div>
    `;
  };

  /**
   * صفحة جميع الدروس
   */
  const renderLessons = () => {
    const lessons = DATA.lessons;

    return `
      <div class="page lessons-page">

        <div class="section-header">
          <h2 class="section-title">جميع الدروس</h2>
          <span class="text-muted">${lessons.length} درس</span>
        </div>

        <div class="grid grid--1">
          ${lessons.map(lesson => `
            <div class="card card--clickable" data-navigate="lesson-detail" data-params='{"id": ${lesson.id}}'>
              <div class="card__header">
                <div>
                  <h3 class="card__title">${_escapeHtml(lesson.title)}</h3>
                  <p class="card__subtitle">${_escapeHtml(lesson.description)}</p>
                </div>
                <div class="card__icon card__icon--blue">${lesson.icon}</div>
              </div>
              <div class="flex items-center justify-between mt-sm">
                <span class="card__tag card__tag--primary">${_escapeHtml(lesson.category)}</span>
                <span class="text-muted" style="font-size: var(--font-size-xs);">⏱ ${_escapeHtml(lesson.duration)}</span>
              </div>
            </div>
          `).join('')}
        </div>

        ${lessons.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state__icon">📚</div>
            <p class="empty-state__title">لا توجد دروس حالياً</p>
            <p class="empty-state__text">سيتم إضافة دروس جديدة قريباً.</p>
          </div>
        ` : ''}

      </div>
    `;
  };

  /**
   * صفحة تفاصيل الدرس
   */
  const renderLessonDetail = (params) => {
    const lesson = DATA.lessons.find(l => l.id === Number(params.id));

    if (!lesson) {
      return `
        <div class="empty-state page">
          <div class="empty-state__icon">❓</div>
          <p class="empty-state__title">الدرس غير موجود</p>
          <button class="btn btn--primary mt-md" data-navigate="lessons">العودة للدروس</button>
        </div>
      `;
    }

    return `
      <div class="page lesson-detail-page">

        <div class="detail-header">
          <button class="back-btn" data-back aria-label="رجوع">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <h1 class="detail-title">${_escapeHtml(lesson.title)}</h1>
        </div>

        <div class="flex items-center gap-sm mb-md">
          <span class="card__tag card__tag--primary">${_escapeHtml(lesson.category)}</span>
          <span class="text-muted" style="font-size: var(--font-size-xs);">⏱ ${_escapeHtml(lesson.duration)}</span>
        </div>

        <div class="lesson-body">
          ${lesson.content}
        </div>

      </div>
    `;
  };

  /**
   * صفحة جميع التمارين
   */
  const renderExercises = () => {
    const exercises = DATA.exercises;

    return `
      <div class="page exercises-page">

        <div class="section-header">
          <h2 class="section-title">جميع التمارين</h2>
          <span class="text-muted">${exercises.length} تمرين</span>
        </div>

        <div class="grid grid--1">
          ${exercises.map(ex => `
            <div class="card card--clickable" data-navigate="exercise-detail" data-params='{"id": ${ex.id}}'>
              <div class="card__header">
                <div>
                  <h3 class="card__title">${_escapeHtml(ex.title)}</h3>
                  <p class="card__subtitle">${_escapeHtml(ex.description)}</p>
                </div>
                <div class="card__icon card__icon--green">${ex.icon}</div>
              </div>
              <div class="flex items-center gap-sm mt-sm">
                <span class="card__tag ${_getDifficultyClass(ex.difficulty)}">${_escapeHtml(ex.difficulty)}</span>
                <span class="text-muted" style="font-size: var(--font-size-xs);">🏆 ${ex.points} نقطة</span>
                ${Storage.isSubmitted(ex.id) ? '<span class="card__tag card__tag--success">✓ تم الإرسال</span>' : ''}
              </div>
            </div>
          `).join('')}
        </div>

      </div>
    `;
  };

  /**
   * صفحة تفاصيل التمرين
   */
  const renderExerciseDetail = (params) => {
    const exercise = DATA.exercises.find(e => e.id === Number(params.id));

    if (!exercise) {
      return `
        <div class="empty-state page">
          <div class="empty-state__icon">❓</div>
          <p class="empty-state__title">التمرين غير موجود</p>
          <button class="btn btn--primary mt-md" data-navigate="exercises">العودة للتمارين</button>
        </div>
      `;
    }

    const isAlreadySubmitted = Storage.isSubmitted(exercise.id);

    return `
      <div class="page exercise-detail-page">

        <div class="detail-header">
          <button class="back-btn" data-back aria-label="رجوع">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <h1 class="detail-title">${_escapeHtml(exercise.title)}</h1>
        </div>

        <div class="flex items-center gap-sm mb-md">
          <span class="card__tag ${_getDifficultyClass(exercise.difficulty)}">${_escapeHtml(exercise.difficulty)}</span>
          <span class="text-muted" style="font-size: var(--font-size-xs);">🏆 ${exercise.points} نقطة</span>
          ${isAlreadySubmitted ? '<span class="card__tag card__tag--success">✓ تم الإرسال سابقاً</span>' : ''}
        </div>

        <!-- Question -->
        <div class="card mb-md">
          <h3 style="font-size: var(--font-size-md); margin-bottom: var(--space-sm);">📝 نص التمرين:</h3>
          <div class="lesson-body" style="padding: 0; border: none; box-shadow: none; background: transparent;">
            ${exercise.question}
          </div>
        </div>

        <!-- Answer Form -->
        <div class="card">
          <h3 style="font-size: var(--font-size-md); margin-bottom: var(--space-md);">✍️ أكتب إجابتك:</h3>

          <form id="exercise-form" class="exercise-form">
            <div class="form-group">
              <label class="form-label" for="answer-input">الإجابة</label>
              <textarea
                class="form-textarea"
                id="answer-input"
                name="answer"
                placeholder="اكتب إجابتك هنا بالتفصيل..."
                rows="5"
                required
              ></textarea>
            </div>

            <button type="submit" class="btn btn--whatsapp btn--full" id="btn-submit-whatsapp">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              إرسال عبر WhatsApp
            </button>
          </form>
        </div>

      </div>
    `;
  };

  /**
   * صفحة التحديثات
   */
  const renderUpdates = async () => {
    const data = await Updates.fetchUpdates();
    Updates.markCurrentVersionAsSeen();
    return Updates.renderUpdatesPage(data);
  };

  /**
   * صفحة غير موجودة
   */
  const renderNotFound = () => {
    return `
      <div class="empty-state page">
        <div class="empty-state__icon">🔍</div>
        <p class="empty-state__title">الصفحة غير موجودة</p>
        <p class="empty-state__text">الصفحة التي تبحث عنها غير موجودة.</p>
        <button class="btn btn--primary mt-md" data-navigate="home">العودة للرئيسية</button>
      </div>
    `;
  };

  /* ──────────────────────────────────────────
     REGISTER ROUTES — تسجيل المسارات
     ────────────────────────────────────────── */

  const _registerRoutes = () => {
    Router.register('home', renderHome, {
      title: 'الرئيسية — أولمبياد المعرفة',
      showNav: true,
      requireAuth: true,
    });

    Router.register('lessons', renderLessons, {
      title: 'الدروس — أولمبياد المعرفة',
      showNav: true,
      requireAuth: true,
    });

    Router.register('lesson-detail', renderLessonDetail, {
      title: 'تفاصيل الدرس — أولمبياد المعرفة',
      showNav: false,
      requireAuth: true,
    });

    Router.register('exercises', renderExercises, {
      title: 'التمارين — أولمبياد المعرفة',
      showNav: true,
      requireAuth: true,
    });

    Router.register('exercise-detail', renderExerciseDetail, {
      title: 'تفاصيل التمرين — أولمبياد المعرفة',
      showNav: false,
      requireAuth: true,
    });

    Router.register('updates', renderUpdates, {
      title: 'التحديثات — أولمبياد المعرفة',
      showNav: true,
      requireAuth: true,
    });

    Router.register('not-found', renderNotFound, {
      title: 'غير موجود — أولمبياد المعرفة',
      showNav: true,
      requireAuth: false,
    });
  };

  /* ──────────────────────────────────────────
     MIDDLEWARE — التحقق من التسجيل
     ────────────────────────────────────────── */

  const _registerMiddleware = () => {
    Router.use((to, from, params) => {
      // إذا الصفحة لا تتطلب تسجيل، نكمل
      if (to === 'not-found') return true;

      // إذا لم يكن مسجلاً، نعيد توجيهه
      if (!Storage.isRegistered()) {
        window.location.href = 'register.html';
        return false;
      }

      return true;
    });
  };

  /* ──────────────────────────────────────────
     EVENT HANDLERS — معالجات الأحداث
     ────────────────────────────────────────── */

  const _bindGlobalEvents = () => {

    // زر التحديثات في Navbar
    DOM.btnUpdates()?.addEventListener('click', () => {
      Router.navigate('updates');
    });

    // زر الملف الشخصي (عرض modal)
    DOM.btnProfile()?.addEventListener('click', _showProfileModal);

    // إغلاق Modal
    DOM.modalClose()?.addEventListener('click', _closeModal);
    DOM.modalOverlay()?.addEventListener('click', (e) => {
      if (e.target === DOM.modalOverlay()) _closeModal();
    });

    // ESC لإغلاق Modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') _closeModal();
    });

    // تفويض أحداث إرسال الإجابة
    document.addEventListener('submit', _handleExerciseSubmit);
  };

  /**
   * معالجة إرسال إجابة التمرين
   */
  const _handleExerciseSubmit = (e) => {
    if (e.target.id !== 'exercise-form') return;
    e.preventDefault();

    const form     = e.target;
    const answer   = form.querySelector('#answer-input')?.value.trim();
    const params   = Router.getParams();
    const exercise = DATA.exercises.find(ex => ex.id === Number(params.id));
    const student  = Storage.getStudent();

    if (!answer) {
      _showToast('الرجاء كتابة الإجابة', 'danger');
      return;
    }

    if (!exercise || !student) {
      _showToast('حدث خطأ، حاول مجدداً', 'danger');
      return;
    }

    // بناء رسالة الواتساب
    const message = `
📝 *إجابة تمرين — أولمبياد المعرفة*

👤 *الاسم:* ${student.fullName}
🎓 *المستوى:* ${student.level}
🏫 *المؤسسة:* ${student.school}

📌 *رقم التمرين:* ${exercise.id}
📖 *عنوان التمرين:* ${exercise.title}

✍️ *الإجابة:*
${answer}
    `.trim();

    // فتح رابط الواتساب
    const encoded = encodeURIComponent(message);
    const url     = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encoded}`;
    window.open(url, '_blank');

    // تسجيل كمُرسَل
    Storage.markAsSubmitted(exercise.id);

    _showToast('تم فتح الواتساب ✓', 'success');

    // إعادة رسم الصفحة لتحديث حالة الإرسال
    setTimeout(() => {
      Router.navigate('exercise-detail', params, { replace: true });
    }, 500);
  };

  /* ──────────────────────────────────────────
     MODAL — نافذة الملف الشخصي
     ────────────────────────────────────────── */

  const _showProfileModal = () => {
    const student = Storage.getStudent();

    DOM.modalContent().innerHTML = `
      <div class="text-center">
        <div style="font-size: 3rem; margin-bottom: var(--space-md);">👤</div>
        <h2 style="font-size: var(--font-size-lg); margin-bottom: var(--space-lg);">الملف الشخصي</h2>
      </div>

      <div class="card" style="text-align: right;">
        <div class="flex items-center gap-md mb-md" style="padding-bottom: var(--space-md); border-bottom: 1px solid var(--clr-border);">
          <strong>الاسم الكامل:</strong>
          <span>${_escapeHtml(student?.fullName || '—')}</span>
        </div>
        <div class="flex items-center gap-md mb-md" style="padding-bottom: var(--space-md); border-bottom: 1px solid var(--clr-border);">
          <strong>المستوى:</strong>
          <span>${_escapeHtml(student?.level || '—')}</span>
        </div>
        <div class="flex items-center gap-md">
          <strong>المؤسسة:</strong>
          <span>${_escapeHtml(student?.school || '—')}</span>
        </div>
      </div>

      <button class="btn btn--danger btn--full mt-lg" id="btn-logout">
        تسجيل الخروج
      </button>

      <p class="text-center text-muted mt-md" style="font-size: var(--font-size-xs);">
        الإصدار ${CONFIG.APP_VERSION}
      </p>
    `;

    DOM.modalOverlay()?.classList.remove('hidden');

    // زر تسجيل الخروج
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      if (confirm('هل تريد تسجيل الخروج؟ سيتم حذف جميع بياناتك.')) {
        Storage.clearAll();
        window.location.href = 'register.html';
      }
    });
  };

  const _closeModal = () => {
    DOM.modalOverlay()?.classList.add('hidden');
  };

  /* ──────────────────────────────────────────
     TOAST — إشعارات صغيرة
     ────────────────────────────────────────── */

  const _showToast = (message, type = 'default') => {
    const toast = DOM.toast();
    if (!toast) return;

    toast.textContent = message;
    toast.className   = 'toast';
    if (type !== 'default') toast.classList.add(`toast--${type}`);

    toast.classList.remove('hidden');

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  };

  /* ──────────────────────────────────────────
     SPLASH SCREEN
     ────────────────────────────────────────── */

  const _hideSplash = () => {
    return new Promise(resolve => {
      setTimeout(() => {
        const splash = DOM.splash();
        const app    = DOM.app();

        if (splash) {
          splash.style.opacity    = '0';
          splash.style.transition = 'opacity 0.4s ease';
          setTimeout(() => splash.classList.add('hidden'), 400);
        }

        if (app) app.classList.remove('hidden');

        resolve();
      }, CONFIG.SPLASH_DURATION);
    });
  };

  /* ──────────────────────────────────────────
     SERVICE WORKER — PWA
     ────────────────────────────────────────── */

  const _registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('sw.js');
        console.info('[App] ✅ Service Worker مسجّل:', reg.scope);
      } catch (err) {
        console.warn('[App] ⚠️ فشل تسجيل Service Worker:', err);
      }
    }
  };

  /* ──────────────────────────────────────────
     HELPERS — أدوات مساعدة
     ────────────────────────────────────────── */

  const _escapeHtml = (str) => Updates.escapeHtml(str);

  const _getDifficultyClass = (difficulty) => {
    const map = {
      'سهل'  : 'card__tag--success',
      'متوسط': 'card__tag--primary',
      'صعب'  : 'card__tag--danger',
    };
    return map[difficulty] || 'card__tag--primary';
  };

  /* ──────────────────────────────────────────
     INIT — تهيئة التطبيق
     ────────────────────────────────────────── */

  const init = async () => {
    console.info('[App] 🚀 بدء تشغيل التطبيق...');

    // التحقق من التسجيل أولاً
    if (!Storage.isRegistered()) {
      window.location.href = 'register.html';
      return;
    }

    // تسجيل المسارات والـ middleware
    _registerRoutes();
    _registerMiddleware();

    // ربط الأحداث العامة
    _bindGlobalEvents();

    // إخفاء Splash
    await _hideSplash();

    // تهيئة الراوتر (يبدأ التنقل)
    Router.init('home');

    // جلب التحديثات في الخلفية
    Updates.fetchUpdates();

    // تسجيل Service Worker
    _registerServiceWorker();

    console.info('[App] ✅ التطبيق جاهز!');
  };

  /* ──────────────────────────────────────────
     PUBLIC API
     ────────────────────────────────────────── */
  return {
    init,
    showToast: _showToast,
    CONFIG,
  };

})();

/* ──────────────────────────────────────────
   DOM READY — تشغيل التطبيق
   ────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => App.init());
