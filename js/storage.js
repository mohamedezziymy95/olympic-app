/* ============================================================
   OLYMPIC APP — STORAGE MODULE
   المسؤول عن كل عمليات localStorage في التطبيق
   ============================================================ */

const Storage = (() => {

  /* ──────────────────────────────────────────
     KEYS — مفاتيح التخزين المحلي
     ────────────────────────────────────────── */
  const KEYS = {
    STUDENT      : 'olympic_student',
    SEEN_VERSION : 'olympic_seen_version',
    LESSONS      : 'olympic_lessons',
    EXERCISES    : 'olympic_exercises',
    SUBMITTED    : 'olympic_submitted',
    SETTINGS     : 'olympic_settings',
  };

  /* ──────────────────────────────────────────
     HELPERS — دوال مساعدة داخلية
     ────────────────────────────────────────── */

  /**
   * حفظ قيمة في localStorage
   * @param {string} key
   * @param {*} value
   */
  const _set = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`[Storage] فشل الحفظ للمفتاح "${key}":`, err);
    }
  };

  /**
   * قراءة قيمة من localStorage
   * @param {string} key
   * @param {*} fallback — قيمة افتراضية إذا لم يوجد شيء
   * @returns {*}
   */
  const _get = (key, fallback = null) => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.error(`[Storage] فشل القراءة للمفتاح "${key}":`, err);
      return fallback;
    }
  };

  /**
   * حذف مفتاح من localStorage
   * @param {string} key
   */
  const _remove = (key) => {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.error(`[Storage] فشل الحذف للمفتاح "${key}":`, err);
    }
  };

  /* ──────────────────────────────────────────
     STUDENT — بيانات التلميذ
     ────────────────────────────────────────── */

  /**
   * حفظ بيانات التلميذ بعد التسجيل
   * @param {{ fullName: string, level: string, school: string }} data
   */
  const saveStudent = (data) => {
    const student = {
      fullName  : data.fullName.trim(),
      level     : data.level.trim(),
      school    : data.school.trim(),
      registeredAt: new Date().toISOString(),
    };
    _set(KEYS.STUDENT, student);
    return student;
  };

  /**
   * جلب بيانات التلميذ المسجّل
   * @returns {{ fullName, level, school, registeredAt } | null}
   */
  const getStudent = () => _get(KEYS.STUDENT, null);

  /**
   * هل التلميذ مسجّل؟
   * @returns {boolean}
   */
  const isRegistered = () => {
    const student = getStudent();
    return student !== null
      && typeof student.fullName === 'string'
      && student.fullName.length > 0;
  };

  /**
   * حذف بيانات التلميذ (تسجيل الخروج / إعادة التسجيل)
   */
  const removeStudent = () => _remove(KEYS.STUDENT);

  /* ──────────────────────────────────────────
     UPDATES — نظام التحديثات
     ────────────────────────────────────────── */

  /**
   * حفظ آخر نسخة شاهدها المستخدم
   * @param {string} version
   */
  const saveSeenVersion = (version) => _set(KEYS.SEEN_VERSION, version);

  /**
   * جلب آخر نسخة شاهدها المستخدم
   * @returns {string | null}
   */
  const getSeenVersion = () => _get(KEYS.SEEN_VERSION, null);

  /**
   * هل هناك نسخة جديدة لم يرها المستخدم بعد؟
   * @param {string} latestVersion — النسخة الموجودة في updates.json
   * @returns {boolean}
   */
  const hasNewVersion = (latestVersion) => {
    const seen = getSeenVersion();
    if (!seen) return true;
    return _compareVersions(latestVersion, seen) > 0;
  };

  /**
   * مقارنة نسختين بصيغة semver (مثال: "1.2.0" vs "1.1.5")
   * @param {string} v1
   * @param {string} v2
   * @returns {number}양수 إذا v1 > v2، سالب إذا v1 < v2، 0 إذا متساويتان
   */
  const _compareVersions = (v1, v2) => {
    const parts1 = String(v1).split('.').map(Number);
    const parts2 = String(v2).split('.').map(Number);
    const length = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < length; i++) {
      const a = parts1[i] ?? 0;
      const b = parts2[i] ?? 0;
      if (a !== b) return a - b;
    }
    return 0;
  };

  /* ──────────────────────────────────────────
     LESSONS — الدروس (كاش محلي)
     ────────────────────────────────────────── */

  /**
   * حفظ قائمة الدروس في الكاش
   * @param {Array} lessons
   */
  const saveLessons = (lessons) => _set(KEYS.LESSONS, lessons);

  /**
   * جلب الدروس من الكاش
   * @returns {Array}
   */
  const getLessons = () => _get(KEYS.LESSONS, []);

  /* ──────────────────────────────────────────
     EXERCISES — التمارين (كاش محلي)
     ────────────────────────────────────────── */

  /**
   * حفظ قائمة التمارين في الكاش
   * @param {Array} exercises
   */
  const saveExercises = (exercises) => _set(KEYS.EXERCISES, exercises);

  /**
   * جلب التمارين من الكاش
   * @returns {Array}
   */
  const getExercises = () => _get(KEYS.EXERCISES, []);

  /* ──────────────────────────────────────────
     SUBMITTED EXERCISES — التمارين المُرسَلة
     ────────────────────────────────────────── */

  /**
   * تسجيل تمرين على أنه تم إرساله
   * @param {string|number} exerciseId
   */
  const markAsSubmitted = (exerciseId) => {
    const list = getSubmittedList();
    if (!list.includes(String(exerciseId))) {
      list.push(String(exerciseId));
      _set(KEYS.SUBMITTED, list);
    }
  };

  /**
   * هل تم إرسال هذا التمرين من قبل؟
   * @param {string|number} exerciseId
   * @returns {boolean}
   */
  const isSubmitted = (exerciseId) => {
    const list = getSubmittedList();
    return list.includes(String(exerciseId));
  };

  /**
   * جلب قائمة كل التمارين المُرسَلة
   * @returns {string[]}
   */
  const getSubmittedList = () => _get(KEYS.SUBMITTED, []);

  /* ──────────────────────────────────────────
     SETTINGS — إعدادات التطبيق
     ────────────────────────────────────────── */

  /**
   * حفظ إعداد معيّن
   * @param {string} key
   * @param {*} value
   */
  const saveSetting = (key, value) => {
    const settings = getSettings();
    settings[key] = value;
    _set(KEYS.SETTINGS, settings);
  };

  /**
   * جلب إعداد معيّن
   * @param {string} key
   * @param {*} fallback
   * @returns {*}
   */
  const getSetting = (key, fallback = null) => {
    const settings = getSettings();
    return key in settings ? settings[key] : fallback;
  };

  /**
   * جلب كل الإعدادات
   * @returns {object}
   */
  const getSettings = () => _get(KEYS.SETTINGS, {});

  /* ──────────────────────────────────────────
     RESET — إعادة ضبط التطبيق
     ────────────────────────────────────────── */

  /**
   * مسح كل بيانات التطبيق من localStorage
   */
  const clearAll = () => {
    Object.values(KEYS).forEach(key => _remove(key));
    console.info('[Storage] تم مسح جميع البيانات.');
  };

  /**
   * جلب حجم البيانات المستخدمة تقريباً (بالكيلوبايت)
   * @returns {string}
   */
  const getStorageSize = () => {
    let total = 0;
    Object.values(KEYS).forEach(key => {
      const item = localStorage.getItem(key);
      if (item) total += item.length * 2; // UTF-16 → bytes
    });
    return (total / 1024).toFixed(2) + ' KB';
  };

  /* ──────────────────────────────────────────
     PUBLIC API
     ────────────────────────────────────────── */
  return {
    // Student
    saveStudent,
    getStudent,
    isRegistered,
    removeStudent,

    // Updates
    saveSeenVersion,
    getSeenVersion,
    hasNewVersion,

    // Lessons
    saveLessons,
    getLessons,

    // Exercises
    saveExercises,
    getExercises,

    // Submitted
    markAsSubmitted,
    isSubmitted,
    getSubmittedList,

    // Settings
    saveSetting,
    getSetting,
    getSettings,

    // Reset
    clearAll,
    getStorageSize,

    // Expose keys (read-only)
    KEYS: Object.freeze({ ...KEYS }),
  };

})();