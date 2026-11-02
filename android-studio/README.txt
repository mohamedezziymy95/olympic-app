مشروع Android Studio جاهز

1. فك الضغط على الحزمة كاملة.
2. افتح Android Studio واختر Open.
3. اختار المجلد android-studio داخل المشروع (ماشي المجلد الرئيسي ديال PWA).
4. وافق على Gradle Sync. أول مرة، Gradle غادي يتحمّل من services.gradle.org ويتحقق البرنامج من SHA-256 قبل ما يستعمله.
5. خاص Android SDK Platform 36 يتثبت من SDK Manager، وJDK 17 (اختار Embedded JDK ديال Android Studio من Settings > Build Tools > Gradle).
6. لإخراج APK تجريبي: Build > Build Bundle(s) / APK(s) > Build APK(s).
7. تلقى الملف في: app/build/outputs/apk/debug/app-debug.apk

المشروع مكتوب بـ Java وWebView، وما محتاجش مكتبات Android خارجية. الدروس والتمارين كيتزامنو من مستودع GitHub، وكيحتافظ التطبيق بآخر نسخة وبيانات التلميذ محلياً. عارض PDF كيعرض الملفات فداخل التطبيق: مرّر الصفحة بإصبع واحد، واستعمل جوج أصابع للتكبير والتصغير، أو أزرار +/- و«ملاءمة». ملفات PDF المضمّنة كتخدم بلا إنترنت؛ وروابط PDF العمومية من GitHub كتتحمّل ثم كتفتح فعارض النادي.

منين تبدّل ملفات الويب، Gradle كينسخ www تلقائياً قبل البناء. إلا بدّلتي data/content.json أو ملفات PDF فالجذر، شغّل أولا من المجلد الرئيسي: node scripts/sync-content.cjs، ومن بعد عاود Build.
