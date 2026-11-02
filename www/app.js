/* نادي الأولمبياد والمسابقات — تطبيق خفيف يعمل دون إطار عمل */
(() => {
  'use strict';

  const CONFIG = {
    repository: 'https://github.com/mohamedezziymy95/olympic-app',
    rawBase: 'https://raw.githubusercontent.com/mohamedezziymy95/olympic-app/main/',
    contentUrl: 'https://raw.githubusercontent.com/mohamedezziymy95/olympic-app/main/data/content.json',
    updatesUrl: 'https://raw.githubusercontent.com/mohamedezziymy95/olympic-app/main/data/updates.json',
    cacheKey: 'olympiad.content.v2',
    profileKey: 'olympiad.profile.v1',
    progressKey: 'olympiad.progress.v1',
    recentKey: 'olympiad.recent.v1',
    maxAge: 30 * 60 * 1000
  };
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const view = $('#view');
  const toast = $('#toast');
  const state = { content: null, updates: null, profile: null, progress: null, recent: [], route: 'home', filter: 'all', quizChoice: null, answerResult: null, hintShown: false, query: '', installPrompt: null, sync: 'local' };
  const localFallback = {
    version: '1.0.0', lessons: [], exercises: [], resources: [], announcements: []
  };
  function withBundledResources(content, bundled) {
    const localResources = Array.isArray(bundled?.resources) ? bundled.resources : [];
    const remoteResources = Array.isArray(content?.resources) ? content.resources : [];
    const localIds = new Set(localResources.map(x => String(x.id)));
    return { ...content, resources: [...localResources, ...remoteResources.filter(x => !localIds.has(String(x.id)))] };
  }
  let toastTimer;

  function read(key, fallback) {
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
    catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { notify('تعذر الحفظ على هذا الجهاز.'); return false; }
  }
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function safeContent(data) {
    return data && typeof data === 'object' && Array.isArray(data.lessons) && Array.isArray(data.exercises) && Array.isArray(data.resources) && data.lessons.every(x => x && x.id && x.title) && data.exercises.every(x => x && x.id && x.title) && data.resources.every(x => x && x.id && x.title && x.file);
  }
  async function fetchJson(url, ms = 9000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  async function loadContent(force = false) {
    const cached = read(CONFIG.cacheKey, null);
    if (!force && cached?.value && Date.now() - cached.savedAt < CONFIG.maxAge && safeContent(cached.value)) {
      try {
        const bundled = await fetch('data/content.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null);
        state.content = withBundledResources(cached.value, bundled);
      } catch { state.content = cached.value; }
      updateSync('cached');
      return;
    }
    try {
      const [bundled, remote] = await Promise.allSettled([
        fetch('data/content.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject()),
        fetchJson(CONFIG.contentUrl)
      ]);
      const local = bundled.status === 'fulfilled' && safeContent(bundled.value) ? bundled.value : localFallback;
      if (remote.status === 'fulfilled' && safeContent(remote.value)) {
        state.content = withBundledResources(remote.value, local);
        write(CONFIG.cacheKey, { value: state.content, savedAt: Date.now() });
        state.sync = 'online';
      } else if (cached?.value && safeContent(cached.value)) {
        state.content = withBundledResources(cached.value, local); state.sync = 'offline';
      } else {
        state.content = withBundledResources(local, local); state.sync = 'local';
      }
    } catch {
      state.content = cached?.value && safeContent(cached.value) ? cached.value : localFallback;
      state.sync = cached?.value ? 'offline' : 'local';
    }
    updateSync(state.sync);
  }
  async function loadUpdates() {
    try {
      const updates = await fetchJson(CONFIG.updatesUrl, 7000);
      if (updates && Array.isArray(updates.changes)) state.updates = updates;
    } catch { /* التحديثات اختيارية؛ المحتوى الأساسي يبقى متاحاً */ }
  }
  function updateSync(mode) {
    state.sync = mode;
    const dot = $('#sync-dot');
    const title = $('#sync-title');
    const text = $('#sync-text');
    if (!dot || !title || !text) return;
    dot.className = `sync-dot ${mode === 'online' ? 'is-online' : mode === 'offline' ? 'is-offline' : ''}`;
    title.textContent = mode === 'online' ? 'المحتوى محدّث' : mode === 'offline' ? 'وضع دون إنترنت' : 'محتوى محفوظ';
    text.textContent = mode === 'online' ? 'تزامن مع مستودع النادي' : mode === 'offline' ? 'نعرض آخر نسخة محفوظة' : 'تقدر تتعلم بلا إنترنت';
  }
  function notify(message) {
    toast.textContent = message; toast.classList.add('is-visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }
  function profile() { return state.profile || { name: '', level: 'الجذع المشترك العلمي', goal: 5 }; }
  function completedCount() { return state.progress.completed.length; }
  function complete(id) {
    if (!state.progress.completed.includes(String(id))) state.progress.completed.push(String(id));
    state.progress.points += Number(state.content.exercises.find(x => String(x.id) === String(id))?.points || 0);
    write(CONFIG.progressKey, state.progress); render(); notify('تحسب لك الإنجاز، برافو!');
  }
  function recordRecent(type, id) {
    state.recent = [{ type, id: String(id), at: Date.now() }, ...state.recent.filter(x => !(x.type === type && x.id === String(id)))].slice(0, 6);
    write(CONFIG.recentKey, state.recent);
  }
  function resourceUrl(file) {
    if (/^(https?:|blob:|data:)/i.test(file)) return file;
    const relative = file.replace(/^\.\//, '');
    if (relative.startsWith('files/club-library/')) return new URL(relative, location.href).href;
    return state.sync === 'online'
      ? new URL(relative, CONFIG.rawBase).href
      : new URL(relative, location.href).href;
  }
  function setRoute(route) {
    state.route = route || 'home'; state.quizChoice = null; state.answerResult = null; state.hintShown = false;
    location.hash = state.route === 'home' ? 'home' : state.route;
    render(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function refreshFromHash() {
    const route = decodeURIComponent(location.hash.replace(/^#\/?/, '') || 'home');
    state.route = route; render();
  }
  function navMarkup() { return ''; }
  function titleFor(route) {
    const labels = { home:'الرئيسية', lessons:'مسارات التعلّم', exercises:'التمارين', library:'مكتبة الوثائق', progress:'تقدمي', settings:'الإعدادات', updates:'آخر المستجدات' };
    if (route.startsWith('lesson:')) return 'مسار التعلّم';
    if (route.startsWith('exercise:')) return 'التدريب';
    return labels[route] || 'الرئيسية';
  }
  function render() {
    if (!state.content) return;
    $('#page-title').textContent = titleFor(state.route);
    const user = profile();
    $('#profile-name').textContent = user.name ? user.name.split(' ')[0] : 'ملفي';
    $('#profile-avatar').textContent = user.name ? [...user.name][0] : 'ط';
    $('#exercise-count').textContent = state.content.exercises.length;
    $$('.nav-link,[data-route]', document).forEach(button => button.classList.toggle('is-active', button.dataset.route === state.route || (state.route.startsWith('lesson:') && button.dataset.route === 'lessons') || (state.route.startsWith('exercise:') && button.dataset.route === 'exercises')));
    if (state.route === 'home') view.innerHTML = renderHome();
    else if (state.route === 'lessons') view.innerHTML = renderLessons();
    else if (state.route.startsWith('lesson:')) view.innerHTML = renderLesson(state.route.split(':')[1]);
    else if (state.route === 'exercises') view.innerHTML = renderExercises();
    else if (state.route.startsWith('exercise:')) view.innerHTML = renderExercise(state.route.split(':')[1]);
    else if (state.route === 'library') view.innerHTML = renderLibrary();
    else if (state.route === 'progress') view.innerHTML = renderProgress();
    else if (state.route === 'settings') view.innerHTML = renderSettings();
    else if (state.route === 'updates') view.innerHTML = renderUpdates();
    else { state.route = 'home'; view.innerHTML = renderHome(); }
    view.focus?.({ preventScroll: true });
  }
  function renderHome() {
    const user = profile();
    const lessons = state.content.lessons.slice(0, 3);
    const exercises = state.content.exercises.slice(0, 3);
    const total = state.content.exercises.length;
    const done = Math.min(completedCount(), total);
    const pct = total ? Math.round(done / total * 100) : 0;
    const greeting = user.name ? `مرحبا ${esc(user.name.split(' ')[0])}،` : 'مرحبا بك،';
    return `<section class="welcome-hero">
      <div class="hero-copy"><span class="hero-kicker"><span class="sparkle">✦</span> مساحة علمية بطموح كبير</span><h1>${greeting}<br>كل مسألة كتقربك من <em>التفوّق</em></h1><p>تعلّم فكرة جديدة، جرّب بيدك، وتابع تقدمك خطوة بخطوة.</p><div class="hero-actions"><button class="button button-gold" data-route="exercises">ابدأ تمريناً <span>←</span></button><button class="button button-glass" data-route="lessons">اكتشف المسارات</button></div></div>
      <div class="hero-art"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="medal">✦<small>OLYMPIAD</small></div><span class="hero-float float-a">فكّر</span><span class="hero-float float-b">جرّب</span><span class="hero-float float-c">تألّق</span></div>
      <div class="hero-bottom"><span>نادي الأولمبياد والمسابقات</span><span>ثانوية الوفاق التأهيلية · سيدي الزوين</span></div>
    </section>
    <section class="stat-grid" aria-label="ملخص التقدم"><article class="stat-card"><span class="stat-icon teal">▤</span><div><small>مسارات التعلّم</small><strong>${state.content.lessons.length}</strong></div><span class="stat-note">مسارات</span></article><article class="stat-card"><span class="stat-icon amber">✎</span><div><small>تمارين متاحة</small><strong>${total}</strong></div><span class="stat-note">للتدرب</span></article><article class="stat-card"><span class="stat-icon blue">◔</span><div><small>إنجازك</small><strong>${pct}<i>%</i></strong></div><span class="stat-note">من التمارين</span></article><article class="stat-card"><span class="stat-icon violet">★</span><div><small>نقاطك</small><strong>${state.progress.points}</strong></div><span class="stat-note">نقطة</span></article></section>
    <div class="section-heading"><div><span class="eyebrow">خطوتك التالية</span><h2>كمّل رحلتك</h2></div><button class="text-button" data-route="lessons">عرض كل المسارات <span>←</span></button></div>
    <section class="card-grid lesson-grid">${lessons.map(lessonCard).join('') || emptyState('مازال ما تزاد حتى مسار تعلّم.')}</section>
    <div class="section-heading section-heading-spaced"><div><span class="eyebrow">تدريب عملي</span><h2>تمارين مختارة ليك</h2></div><button class="text-button" data-route="exercises">عرض جميع التمارين <span>←</span></button></div>
    <section class="card-grid exercise-grid">${exercises.map(exerciseCard).join('') || emptyState('مازال ما تزاد حتى تمرين.')}</section>
    <section class="quote-strip"><span class="quote-mark">“</span><p>${esc(state.content.announcements?.[0] || 'كل مسألة صعبة كتبدأ بفكرة بسيطة.')}</p><span class="quote-label">نصيحة النادي</span></section>`;
  }
  function lessonCard(x) {
    const done = state.progress.lessons.includes(String(x.id));
    return `<button class="content-card lesson-card" data-open-lesson="${esc(x.id)}"><span class="card-symbol">${esc(x.icon || '∑')}</span><span class="card-category">${esc(x.category || 'مسار')}</span><h3>${esc(x.title)}</h3><p>${esc(x.description || '')}</p><span class="card-meta">${esc(x.duration || 'مسار قصير')} <b>${done ? '✓ مكتمل' : '↗ افتح المسار'}</b></span></button>`;
  }
  function exerciseCard(x) {
    const done = state.progress.completed.includes(String(x.id));
    return `<button class="content-card exercise-card" data-open-exercise="${esc(x.id)}"><span class="exercise-top"><span class="difficulty ${difficultyClass(x.difficulty)}">${esc(x.difficulty || 'تدريب')}</span><span class="points">${Number(x.points || 0)} نقطة</span></span><span class="card-category">${esc(x.topic || 'مسألة')}</span><h3>${esc(x.title)}</h3><p>${esc(x.description || '')}</p><span class="card-meta">${esc(x.level || 'جميع المستويات')} <b>${done ? '✓ منجز' : 'حلّ التمرين ↗'}</b></span></button>`;
  }
  function difficultyClass(value) { return value === 'سهل' ? 'easy' : value === 'صعب' ? 'hard' : 'medium'; }
  function renderLessons() {
    const list = state.content.lessons.filter(x => matchQuery(`${x.title} ${x.description} ${x.category} ${x.level}`));
    return `<div class="page-intro"><div><span class="eyebrow">تعلّم بالفكرة والبرهان</span><h1>مسارات التعلّم</h1><p>مفاهيم مركّزة وتمارين تساعدك تبني أدوات التفكير الأولمبيادي.</p></div><div class="intro-mark">∑</div></div><form class="searchbar" data-search-form><span>⌕</span><input id="search-input" value="${esc(state.query)}" placeholder="قلب على درس أو محور…"><button class="button button-primary">بحث</button></form><section class="card-grid lesson-grid">${list.map(lessonCard).join('') || emptyState('ما لقيناش مسار بهاد الكلمات.')}</section>`;
  }
  function renderLesson(id) {
    const item = state.content.lessons.find(x => String(x.id) === id);
    if (!item) return emptyState('هاد المسار ما بقاش متاح.', 'lessons');
    recordRecent('lesson', id);
    const done = state.progress.lessons.includes(String(id));
    const related = state.content.exercises.filter(x => x.topic === item.category).slice(0, 2);
    return `<button class="back-link" data-route="lessons">→ رجوع للمسارات</button><article class="detail-panel"><div class="detail-symbol">${esc(item.icon || '∑')}</div><div class="detail-kicker">${esc(item.category || 'مسار تعلّم')} · ${esc(item.duration || 'درس قصير')}</div><h1>${esc(item.title)}</h1><p class="detail-lead">${esc(item.description || '')}</p><div class="detail-body"><h2>الفكرة الأساسية</h2><p>${esc(item.content || 'راجع الفكرة، دوّن الملاحظات، ثم انتقل إلى التمرين المرتبط.')}</p><div class="tip-box"><strong>طريقة العمل</strong><span>حاول تشرح الفكرة بكلماتك، وارسم أو اكتب مثالاً من إنشائك.</span></div></div><div class="detail-actions"><button class="button ${done ? 'button-success' : 'button-primary'}" data-complete-lesson="${esc(id)}">${done ? '✓ تم إكمال المسار' : 'علّم المسار كمكتمل'}</button>${related.map(e => `<button class="button button-quiet" data-open-exercise="${esc(e.id)}">جرّب: ${esc(e.title)}</button>`).join('')}</div></article>`;
  }
  function renderExercises() {
    const list = state.content.exercises.filter(x => (state.filter === 'all' || x.difficulty === state.filter) && matchQuery(`${x.title} ${x.description} ${x.topic} ${x.level}`));
    return `<div class="page-intro"><div><span class="eyebrow">درّب عقلك كل يوم</span><h1>التمارين</h1><p>اختار تمريناً، خذ وقتك فالتفكير، وسجّل إنجازك.</p></div><div class="intro-mark">✎</div></div><form class="searchbar" data-search-form><span>⌕</span><input id="search-input" value="${esc(state.query)}" placeholder="قلب على تمرين أو محور…"><button class="button button-primary">بحث</button></form><div class="filter-row" role="group" aria-label="تصفية حسب الصعوبة"><button data-filter="all" class="filter-chip ${state.filter === 'all' ? 'active' : ''}">الكل <small>${state.content.exercises.length}</small></button><button data-filter="سهل" class="filter-chip ${state.filter === 'سهل' ? 'active' : ''}">سهل</button><button data-filter="متوسط" class="filter-chip ${state.filter === 'متوسط' ? 'active' : ''}">متوسط</button><button data-filter="صعب" class="filter-chip ${state.filter === 'صعب' ? 'active' : ''}">صعب</button></div><section class="card-grid exercise-grid">${list.map(exerciseCard).join('') || emptyState('ما لقيناش تمارين بهاد الاختيار.')}</section>`;
  }
  function renderExercise(id) {
    const item = state.content.exercises.find(x => String(x.id) === id);
    if (!item) return emptyState('هاد التمرين ما بقاش متاح.', 'exercises');
    recordRecent('exercise', id);
    const done = state.progress.completed.includes(String(id));
    const choices = Array.isArray(item.choices) ? item.choices : [];
    const selected = state.quizChoice;
    const result = state.answerResult?.id === String(item.id) ? state.answerResult : null;
    const nativeAndroid = navigator.userAgent.includes('OlympiadClubAndroid');
    const target = nativeAndroid || window.Capacitor?.isNativePlatform?.() ? '_self' : '_blank';
    const feedback = result ? (result.score >= Number(item.points || 0)
      ? `<div class="answer-feedback is-visible"><strong class="correct">جواب كامل! ${result.scoreGain ? `+${result.scoreGain} نقطة` : 'نقط التمرين مسجلة من قبل'}</strong><p>${esc(item.explanation || 'راجع الحل ثم انتقل إلى التمرين التالي.')}</p></div>`
      : `<div class="answer-feedback is-visible"><strong class="${result.score > 0 ? 'correct' : 'incorrect'}">${result.score > 0 ? `تنقيط جزئي: ${result.score} من ${Number(item.points || 0)} نقطة.` : 'الجواب غير صحيح؛ المحاولة جزء من التعلّم.'} ${result.scoreGain ? `زادت ${result.scoreGain} نقطة لرصيدك.` : ''}</strong>${item.hint ? `<p><b>تلميح:</b> ${esc(item.hint)}</p>` : ''}${item.remediation ? `<p><b>راجع:</b> ${esc(item.remediation)}</p>` : ''}<p><b>الفكرة والحل:</b> ${esc(item.explanation || 'أعد قراءة المعطيات وجرب طريقة مختلفة.')}</p><button class="button button-quiet" data-try-again>جرّب من جديد</button></div>`)
      : '';
    return `<button class="back-link" data-route="exercises">→ رجوع للتمارين</button><article class="detail-panel exercise-detail"><div class="exercise-top"><span class="difficulty ${difficultyClass(item.difficulty)}">${esc(item.difficulty || 'تدريب')}</span><span class="points">${Number(item.points || 0)} نقطة</span></div><div class="detail-kicker">${esc(item.topic || 'مسألة أولمبيادية')} · ${esc(item.level || 'جميع المستويات')}</div><h1>${esc(item.title)}</h1><p class="detail-lead">${esc(item.description || '')}</p><div class="problem-box"><span class="problem-label">المسألة</span><p>${esc(item.prompt || item.question || 'افتح ملف التمرين المرفق وجرّب الحل.')}</p></div>${choices.length ? `<div class="choice-list">${choices.map((choice, i) => `<button class="choice ${selected === i ? 'selected' : ''}" data-choice="${i}"><span class="choice-letter">${String.fromCharCode(65+i)}</span>${esc(choice)}</button>`).join('')}</div>${item.hint ? `<button class="button button-quiet" data-show-hint>${state.hintShown ? 'إخفاء التلميح' : 'أعطني تلميحاً'}</button>${state.hintShown ? `<div class="tip-box"><strong>تلميح</strong><span>${esc(item.hint)}</span></div>` : ''}` : ''}${result ? '' : `<button class="button button-primary check-answer" data-check-answer="${esc(id)}">تحقّق من الإجابة</button>`}${feedback}` : `<a class="button button-primary" href="${esc(resourceUrl(item.file))}" target="${target}" rel="noopener">فتح ملف التمرين ↗</a>`}${done ? '<div class="completed-banner">✓ هذا التمرين مسجل ضمن إنجازاتك.</div>' : ''}</article>`;
  }
  function renderLibrary() {
    const list = state.content.resources.filter(x => matchQuery(`${x.title} ${x.description} ${x.type} ${x.subject} ${x.level}`));
    return `<div class="page-intro"><div><span class="eyebrow">مرجعك في أي وقت</span><h1>مكتبة الوثائق</h1><p>الملفات كتتجلب من مستودع النادي ويمكن فتحها أو تحميلها.</p></div><div class="intro-mark">▣</div></div><form class="searchbar" data-search-form><span>⌕</span><input id="search-input" value="${esc(state.query)}" placeholder="قلب على وثيقة أو مادة…"><button class="button button-primary">بحث</button></form><section class="resource-list">${list.map(resourceCard).join('') || emptyState('ما لقيناش وثائق مطابقة.')}</section><p class="source-note"><span class="sync-dot ${state.sync === 'online' ? 'is-online' : ''}"></span> مصدر المحتوى: مستودع GitHub ديال النادي</p>`;
  }
  function resourceCard(x) {
    const nativeAndroid = navigator.userAgent.includes('OlympiadClubAndroid');
    const target = nativeAndroid || window.Capacitor?.isNativePlatform?.() ? '_self' : '_blank';
    return `<article class="resource-card"><span class="resource-icon">PDF</span><div class="resource-copy"><div class="card-category">${esc(x.subject || x.type || 'وثيقة')} · ${esc(x.level || 'مورد النادي')}</div><h3>${esc(x.title)}</h3><p>${esc(x.description || '')}</p><small>${esc(x.format || 'PDF')}${x.date ? ` · ${esc(x.date)}` : ''}</small></div><a class="button button-quiet" href="${esc(resourceUrl(x.file))}" target="${target}" rel="noopener" aria-label="فتح ${esc(x.title)}">فتح الملف ↗</a></article>`;
  }
  function renderProgress() {
    const total = state.content.exercises.length;
    const done = Math.min(completedCount(), total);
    const pct = total ? Math.round(done / total * 100) : 0;
    const attempts = Array.isArray(state.progress.attempts) ? state.progress.attempts : [];
    const earned = attempts.reduce((sum,x) => sum + (Number(x.score) || 0), 0);
    const possible = attempts.reduce((sum,x) => sum + (Number(x.maxScore) || 0), 0);
    const accuracy = possible ? Math.round(earned / possible * 100) : 0;
    const topics = [...new Set(state.content.exercises.map(x => x.topic || 'مسائل متنوعة'))];
    const support = topics.map(topic => {
      const topicAttempts = attempts.filter(x => x.topic === topic);
      const mistakes = topicAttempts.filter(x => !x.correct).length;
      return { topic, attempts: topicAttempts.length, mistakes };
    }).filter(x => x.attempts).sort((a,b) => b.mistakes-a.mistakes).slice(0,3);
    const user = profile();
    const target = Number(user.goal || 5);
    const weekDone = Math.min(done, target);
    return `<div class="page-intro"><div><span class="eyebrow">كل خطوة محسوبة</span><h1>تقدمي</h1><p>النتائج والملاحظات محفوظة على هذا الجهاز، حتى بلا حساب.</p></div><div class="intro-mark">◔</div></div><section class="progress-overview"><div class="progress-ring" style="--progress:${pct}%"><div><strong>${pct}%</strong><small>تمارين منجزة</small></div></div><div class="progress-copy"><span class="eyebrow">استمر على نفس الوتيرة</span><h2>${done} من ${total} تمارين مكتملة</h2><p>${state.progress.points} نقطة · ${attempts.length} محاولة · ${accuracy}% أجوبة صحيحة</p><button class="button button-primary" data-route="exercises">كمّل التدريب</button></div></section><section class="progress-cards"><article class="panel-card"><span class="stat-icon amber">★</span><small>مجموع النقاط</small><strong>${state.progress.points}</strong></article><article class="panel-card"><span class="stat-icon teal">✓</span><small>المسارات المكتملة</small><strong>${state.progress.lessons.length}</strong></article><article class="panel-card"><span class="stat-icon blue">◎</span><small>هدف الأسبوع</small><strong>${weekDone}<i> / ${target}</i></strong></article></section><section class="settings-card support-summary"><span class="eyebrow">مراجعة ذكية</span><h2>محاور تحتاج مراجعة</h2>${support.length ? `<ul>${support.map(x => `<li><b>${esc(x.topic)}</b><span>${x.mistakes} أخطاء من ${x.attempts} محاولات</span></li>`).join('')}</ul>` : '<p>منين تجرب التمارين، غادي نحدد ليك المحاور اللي تستحق مراجعة أكثر.</p>'}<button class="button button-quiet" data-share-report>مشاركة تقرير التقدم</button></section><div class="section-heading section-heading-spaced"><div><span class="eyebrow">آخر ما اشتغلت عليه</span><h2>متابعة حديثة</h2></div></div><section class="recent-list">${renderRecent()}</section>`;
  }
  function renderRecent() {
    if (!state.recent.length) return emptyState('منين تبدا أول درس أو تمرين، غادي يبان هنا.');
    return state.recent.map(item => {
      const data = item.type === 'lesson' ? state.content.lessons.find(x => String(x.id) === item.id) : state.content.exercises.find(x => String(x.id) === item.id);
      if (!data) return '';
      return `<button class="recent-item" data-${item.type === 'lesson' ? 'open-lesson' : 'open-exercise'}="${esc(item.id)}"><span>${item.type === 'lesson' ? '▤' : '✎'}</span><strong>${esc(data.title)}</strong><small>${item.type === 'lesson' ? 'مسار' : 'تمرين'}</small><b>←</b></button>`;
    }).join('');
  }
  function renderSettings() {
    const user = profile();
    return `<div class="page-intro"><div><span class="eyebrow">تجربة على قياسك</span><h1>الإعدادات</h1><p>بدّل بياناتك، حدّث محتوى النادي، أو صفّر بيانات هذا الجهاز.</p></div><div class="intro-mark">⚙</div></div><section class="settings-grid"><article class="settings-card"><span class="stat-icon violet">ط</span><h2>الملف الدراسي</h2><p>${esc(user.name || 'مازال ما كملتيش الملف الشخصي')}<br>${esc(user.level || 'الجذع المشترك العلمي')}</p><button class="button button-quiet" data-open-profile>تعديل الملف</button></article><article class="settings-card"><span class="stat-icon teal">↻</span><h2>محتوى النادي</h2><p>تحديث الدروس والتمارين والوثائق من مستودع GitHub.</p><button class="button button-primary" data-refresh>تحديث المحتوى</button></article><article class="settings-card danger-card"><span class="stat-icon amber">⌫</span><h2>إعادة ضبط التقدم</h2><p>يمسح التمارين المكتملة والنقاط المحفوظة على هذا الجهاز فقط.</p><button class="button button-danger" data-reset-progress>مسح التقدم</button></article><article class="settings-card"><span class="stat-icon blue">↗</span><h2>المصدر</h2><p>الملفات والتمارين قابلة للتحديث من مستودع النادي.</p><a class="button button-quiet" href="${CONFIG.repository}" target="_blank" rel="noopener">فتح مستودع GitHub ↗</a></article><article class="settings-card"><span class="stat-icon amber">✦</span><h2>آخر المستجدات</h2><p>شوف الإضافات والتحسينات اللي وصلات للمنصة.</p><button class="button button-quiet" data-route="updates">عرض المستجدات</button></article></section>`;
  }
  function renderUpdates() {
    const updates = state.updates;
    if (!updates) return `<div class="page-intro"><div><span class="eyebrow">مواكبة المنصة</span><h1>آخر المستجدات</h1><p>ما قدرناش نوصلو للتحديثات الآن؛ تقدر تستعمل التطبيق عادي.</p></div><div class="intro-mark">↻</div></div><button class="button button-primary" data-refresh>إعادة المحاولة</button>`;
    return `<div class="page-intro"><div><span class="eyebrow">الإصدار ${esc(updates.version || '—')}</span><h1>${esc(updates.title || 'آخر المستجدات')}</h1><p>${esc(updates.description || '')}</p></div><div class="intro-mark">✦</div></div><article class="updates-panel"><small>${esc(updates.date || '')}</small><h2>شنو تزاد أو تحسّن؟</h2><ul>${updates.changes.map(change => `<li><span class="change-badge">${change.type === 'new' ? '+' : '↗'}</span>${esc(change.text)}</li>`).join('')}</ul></article>`;
  }
  function emptyState(text, route) { return `<div class="empty-state"><span>⌕</span><strong>${esc(text)}</strong>${route ? `<button class="button button-quiet" data-route="${route}">رجوع</button>` : ''}</div>`; }
  function matchQuery(text) { return !state.query || String(text).toLowerCase().includes(state.query.toLowerCase().trim()); }

  $('#side-nav').addEventListener('click', e => { const button = e.target.closest('[data-route]'); if (button) setRoute(button.dataset.route); });
  $('#mobile-nav').addEventListener('click', e => { const button = e.target.closest('[data-route]'); if (button) setRoute(button.dataset.route); });
  view.addEventListener('click', e => {
    const filter = e.target.closest('[data-filter]'); if (filter) { state.filter = filter.dataset.filter; render(); return; }
    const route = e.target.closest('[data-route]'); if (route) { setRoute(route.dataset.route); return; }
    const lesson = e.target.closest('[data-open-lesson]'); if (lesson) { setRoute(`lesson:${lesson.dataset.openLesson}`); return; }
    const exercise = e.target.closest('[data-open-exercise]'); if (exercise) { setRoute(`exercise:${exercise.dataset.openExercise}`); return; }
    const choice = e.target.closest('[data-choice]'); if (choice) { state.quizChoice = Number(choice.dataset.choice); state.answerResult = null; render(); return; }
    if (e.target.closest('[data-show-hint]')) { state.hintShown = !state.hintShown; render(); return; }
    if (e.target.closest('[data-try-again]')) { state.quizChoice = null; state.answerResult = null; render(); return; }
    const check = e.target.closest('[data-check-answer]'); if (check) {
      const task = state.content.exercises.find(x => String(x.id) === check.dataset.checkAnswer);
      if (state.quizChoice === null) { notify('اختار جواب قبل ما تتحقق.'); return; }
      if (!Array.isArray(state.progress.attempts)) state.progress.attempts = [];
      const correct = state.quizChoice === Number(task.answer);
      if (!state.progress.bestScores || typeof state.progress.bestScores !== 'object') state.progress.bestScores = {};
      const maximum = Math.max(0, Number(task.points) || 0);
      const rawScore = Array.isArray(task.choiceScores) ? Number(task.choiceScores[state.quizChoice]) || 0 : (correct ? maximum : 0);
      const score = Math.max(0, Math.min(maximum, rawScore));
      const previousBest = Number(state.progress.bestScores[String(task.id)]) || 0;
      const scoreGain = Math.max(0, score - previousBest);
      state.progress.bestScores[String(task.id)] = Math.max(previousBest, score);
      const firstSuccess = score >= maximum && !state.progress.completed.includes(String(task.id));
      state.progress.attempts.push({ exerciseId: String(task.id), title: task.title, topic: task.topic || 'مسائل متنوعة', answerIndex: state.quizChoice, correctAnswerIndex: Number(task.answer), score, maxScore: maximum, correct, at: new Date().toISOString(), hintUsed: state.hintShown });
      state.progress.attempts = state.progress.attempts.slice(-200);
      if (firstSuccess) state.progress.completed.push(String(task.id));
      state.progress.points += scoreGain;
      state.answerResult = { id: String(task.id), correct, firstSuccess, score, scoreGain };
      write(CONFIG.progressKey, state.progress);
      render(); return;
    }
    if (e.target.closest('[data-share-report]')) { shareProgressReport(); return; }
    const doneLesson = e.target.closest('[data-complete-lesson]'); if (doneLesson) {
      const id = String(doneLesson.dataset.completeLesson);
      if (!state.progress.lessons.includes(id)) { state.progress.lessons.push(id); write(CONFIG.progressKey, state.progress); notify('تسجل المسار كمكتمل.'); }
      render(); return;
    }
    if (e.target.closest('[data-open-profile]')) { openProfile(); return; }
    if (e.target.closest('[data-refresh]')) { refreshContent(); return; }
    if (e.target.closest('[data-reset-progress]')) {
      if (confirm('واش متأكد؟ غادي يتم مسح التقدم والنقاط والمحاولات المحفوظة على هاد الجهاز.')) { state.progress = { completed: [], lessons: [], points: 0, attempts: [], bestScores: {} }; state.recent = []; write(CONFIG.progressKey, state.progress); write(CONFIG.recentKey, state.recent); render(); notify('تم مسح التقدم.'); }
    }
  });
  view.addEventListener('submit', e => {
    if (e.target.matches('[data-search-form]')) { e.preventDefault(); state.query = $('#search-input', e.target).value.trim(); render(); }
  });
  $('#refresh-button').addEventListener('click', refreshContent);
  $('#settings-button').addEventListener('click', () => setRoute('settings'));
  $('#pwa-install').addEventListener('click', async () => {
    if (state.installPrompt) { const prompt = state.installPrompt; state.installPrompt = null; await prompt.prompt(); return; }
    const isApple = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    notify(isApple ? 'في Safari: ضغط على مشاركة ثم «إضافة إلى الشاشة الرئيسية».' : 'من قائمة المتصفح اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».');
  });
  $('#profile-button').addEventListener('click', openProfile);
  function openProfile() {
    const dialog = $('#profile-dialog'); const user = profile();
    const form = $('#profile-form'); form.elements.name.value = user.name || ''; form.elements.level.value = user.level || 'الجذع المشترك العلمي'; form.elements.goal.value = user.goal || 5;
    dialog.showModal();
  }
  async function shareProgressReport() {
    const attempts = Array.isArray(state.progress.attempts) ? state.progress.attempts : [];
    const correct = attempts.filter(x => x.correct).length;
    const earned = attempts.reduce((sum,x) => sum + (Number(x.score) || 0), 0);
    const possible = attempts.reduce((sum,x) => sum + (Number(x.maxScore) || 0), 0);
    const accuracy = possible ? Math.round(earned / possible * 100) : 0;
    const topicRows = [...new Set(attempts.map(x => x.topic))].map(topic => {
      const rows = attempts.filter(x => x.topic === topic);
      const wrong = rows.filter(x => !x.correct).length;
      return `• ${topic}: ${rows.length-wrong}/${rows.length} إجابات صحيحة؛ ${wrong} تحتاج مراجعة`;
    });
    const text = [`تقرير التقدم — نادي الأولمبياد والمسابقات`, `التلميذ(ة): ${profile().name || 'بدون اسم'} · ${profile().level}`, `التمارين المكتملة: ${completedCount()} من ${state.content.exercises.length}`, `النقاط: ${state.progress.points}`, `المعدل حسب النقط: ${accuracy}% · أجوبة كاملة: ${correct}/${attempts.length}`, ``, `حسب المحاور:`, ...(topicRows.length ? topicRows : ['• لم تُسجل محاولات بعد.']), ``, `تم الإنشاء: ${new Date().toLocaleDateString('ar-MA')}`].join('\n');
    try {
      if (navigator.share) await navigator.share({ title: 'تقرير التقدم — نادي الأولمبياد', text });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); notify('تنسخ تقرير التقدم. تقدر تلصقو فواتساب أو البريد.'); }
      else {
        const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([text], {type:'text/plain;charset=utf-8'})); link.download = 'rapport-progression-olympiade.txt'; link.click(); URL.revokeObjectURL(link.href);
      }
    } catch (error) { if (error?.name !== 'AbortError') notify('تعذر مشاركة التقرير على هذا الجهاز.'); }
  }
  $('#cancel-profile').addEventListener('click', () => $('#profile-dialog').close());
  $('#profile-form').addEventListener('submit', e => {
    e.preventDefault(); const form = e.currentTarget;
    state.profile = { name: form.elements.name.value.trim(), level: form.elements.level.value, goal: Math.max(1, Math.min(30, Number(form.elements.goal.value) || 5)) };
    write(CONFIG.profileKey, state.profile); $('#profile-dialog').close(); render(); notify('تحدّث الملف الشخصي.');
  });
  async function refreshContent() {
    updateSync('offline'); notify('كنحدّث محتوى النادي…');
    await loadContent(true); await loadUpdates(); render();
    notify(state.sync === 'online' ? 'تحدّث محتوى النادي بنجاح.' : 'ما قدرناش نوصلو للمستودع؛ بقات آخر نسخة محفوظة.');
  }
  window.addEventListener('hashchange', refreshFromHash);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); state.installPrompt = event; $('#pwa-install')?.classList.add('is-install-ready'); });
  window.addEventListener('appinstalled', () => { state.installPrompt = null; notify('تثبت التطبيق بنجاح.'); });
  async function registerServiceWorker() {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      try { await navigator.serviceWorker.register('./sw.js', { scope: './' }); } catch (err) { console.warn('تعذر تسجيل التخزين دون اتصال', err); }
    }
  }
  async function start() {
    state.profile = read(CONFIG.profileKey, null);
    state.progress = read(CONFIG.progressKey, { completed: [], lessons: [], points: 0, attempts: [], bestScores: {} });
    if (!Array.isArray(state.progress.completed)) state.progress.completed = [];
    if (!Array.isArray(state.progress.lessons)) state.progress.lessons = [];
    if (!Array.isArray(state.progress.attempts)) state.progress.attempts = [];
    if (!state.progress.bestScores || typeof state.progress.bestScores !== 'object') state.progress.bestScores = {};
    state.recent = read(CONFIG.recentKey, []);
    const cached = read(CONFIG.cacheKey, null);
    if (cached?.value && safeContent(cached.value)) {
      state.content = cached.value;
      updateSync(Date.now() - cached.savedAt < CONFIG.maxAge ? 'cached' : 'offline');
    } else {
      try {
        const bundled = await fetch('data/content.json', { cache: 'no-cache' });
        const local = bundled.ok ? await bundled.json() : null;
        state.content = safeContent(local) ? local : localFallback;
      } catch { state.content = localFallback; }
      updateSync('local');
    }
    state.route = decodeURIComponent(location.hash.replace(/^#\/?/, '') || 'home');
    if (state.route === 'home' && !state.profile) setTimeout(openProfile, 450);
    render(); registerServiceWorker();
    loadContent().then(async () => { await loadUpdates(); render(); });
  }
  start();
})();
