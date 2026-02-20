Markdown

# 🏆 أولمبياد الفيزياء والكيمياء  — تطبيق PWA تعليمي

> تطبيق ويب تقدمي (PWA) للتحضير للأولمبياد، يتضمن دروس وتمارين تفاعلية مع إمكانية إرسال الإجابات عبر WhatsApp.

---

## 📁 هيكلة المشروع الكاملة
olympic-app/
│
├── index.html ← الصفحة الرئيسية
├── register.html ← صفحة تسجيل التلميذ
├── manifest.json ← ملف PWA
├── sw.js ← Service Worker
├── README.md ← هذا الملف
│
├── css/
│ └── main.css ← التنسيقات الرئيسية
│
├── js/
│ ├── storage.js ← إدارة localStorage
│ ├── updates.js ← نظام التحديثات
│ ├── router.js ← التنقل بين الصفحات
│ └── app.js ← الملف الرئيسي
│
├── data/
│ └── updates.json ← بيانات التحديثات (تُرفع على GitHub)
│
└── assets/
├── icons/
│ ├── icon-72.png
│ ├── icon-96.png
│ ├── icon-128.png
│ ├── icon-144.png
│ ├── icon-152.png
│ ├── icon-192.png
│ ├── icon-384.png
│ ├── icon-512.png
│ ├── shortcut-lessons.png
│ └── shortcut-exercises.png
│
└── screenshots/
├── home.png
└── lessons.png

text


---

## 🎨 إنشاء الأيقونات

### الطريقة 1: أداة أونلاين (الأسهل)

1. صمم شعاراً مربعاً **512×512 بكسل** بصيغة PNG
2. ارفعه على أحد هذه المواقع:
   - [PWA Image Generator](https://www.pwabuilder.com/imageGenerator)
   - [RealFaviconGenerator](https://realfavicongenerator.net/)
   - [App Icon Generator](https://appicon.co/)
3. حمّل جميع الأحجام وضعها في مجلد `assets/icons/`

### الطريقة 2: باستخدام أداة Sharp (Node.js)

```bash
npm install sharp
node generate-icons.js
الطريقة 3: أيقونة مؤقتة للتجربة
استخدم ملف generate-icons.html المرفق لتوليد أيقونات SVG مؤقتة.

الأحجام المطلوبة:
الحجم	الاستخدام
72×72	Android ldpi
96×96	Android mdpi / Favicon
128×128	Chrome Web Store
144×144	Windows Tiles
152×152	iOS Safari
192×192	Android / PWA Install
384×384	Android Splash
512×512	PWA Splash / Store
⚙️ إعداد المشروع
1. استنساخ المشروع
Bash

git clone https://github.com/YOUR_USERNAME/olympic-app.git
cd olympic-app
2. تعديل الإعدادات
في js/app.js:

JavaScript

WHATSAPP_NUMBER: '212600000000',  // ← ضع رقمك
في js/updates.js:

JavaScript

JSON_URL: 'https://raw.githubusercontent.com/YOUR_USERNAME/olympic-app/main/data/updates.json',
3. تشغيل محلياً
Bash

# باستخدام Python
python -m http.server 8080

# أو باستخدام Node.js
npx serve .

# أو باستخدام Live Server في VS Code
# ← فقط اضغط Go Live
4. فتح في المتصفح
text

http://localhost:8080
🚀 رفع على GitHub Pages
Bash

# تهيئة Git
git init
git add .
git commit -m "🚀 Initial release v1.0.0"

# ربط بـ GitHub
git remote add origin https://github.com/YOUR_USERNAME/olympic-app.git
git branch -M main
git push -u origin main
تفعيل GitHub Pages:

اذهب إلى Settings → Pages
اختر Source: Deploy from a branch
اختر Branch: main → /root
اضغط Save
التطبيق سيكون متاحاً على:
text

https://YOUR_USERNAME.github.io/olympic-app/
📱 التحويل إلى Android / iOS باستخدام Capacitor
1. تهيئة المشروع
Bash

# تثبيت Node.js أولاً من https://nodejs.org

# إنشاء package.json
npm init -y

# تثبيت Capacitor
npm install @capacitor/core @capacitor/cli

# تهيئة Capacitor
npx cap init "أولمبياد الفيزياء والكيمياء " "com.olympic.app" --web-dir "."
2. إنشاء تطبيق Android
Bash

# تثبيت منصة Android
npm install @capacitor/android

# إضافة المنصة
npx cap add android

# نسخ الملفات
npx cap sync android

# فتح في Android Studio
npx cap open android
3. إنشاء تطبيق iOS
Bash

# تثبيت منصة iOS (يتطلب Mac)
npm install @capacitor/ios

# إضافة المنصة
npx cap add ios

# نسخ الملفات
npx cap sync ios

# فتح في Xcode
npx cap open ios
4. بعد كل تعديل
Bash

npx cap sync
5. ملف capacitor.config.json المُقترح
JSON

{
  "appId": "com.olympic.app",
  "appName": "أولمبياد الفيزياء والكيمياء ",
  "webDir": ".",
  "server": {
    "androidScheme": "https"
  },
  "plugins": {
    "SplashScreen": {
      "launchAutoHide": true,
      "androidSplashResourceName": "splash",
      "showSpinner": false,
      "backgroundColor": "#1a73e8"
    },
    "StatusBar": {
      "style": "LIGHT",
      "backgroundColor": "#1a73e8"
    }
  }
}
🔄 كيفية تحديث المحتوى
إضافة درس جديد
في js/app.js داخل DATA.lessons:

JavaScript

{
  id: 4,
  title: 'عنوان الدرس الجديد',
  description: 'وصف قصير',
  icon: '📘',
  category: 'رياضيات',
  duration: '20 دقيقة',
  content: `<h3>المحتوى هنا...</h3><p>...</p>`,
},
إضافة تمرين جديد
في js/app.js داخل DATA.exercises:

JavaScript

{
  id: 5,
  title: 'تمرين 5: العنوان',
  description: 'وصف قصير',
  icon: '✏️',
  difficulty: 'متوسط',
  points: 20,
  question: `<p>نص التمرين هنا...</p>`,
},
إصدار تحديث جديد
عدّل data/updates.json على GitHub
غيّر رقم version (مثال: "1.1.0")
أضف التغييرات الجديدة في changes
المستخدمون سيرون إشعاراً تلقائياً ✅
🧪 اختبار PWA
في Chrome DevTools:
افتح F12 → Application
تحقق من:
✅ Service Worker مسجّل
✅ Manifest محمّل
✅ Cache Storage يحتوي الملفات
جرب Offline Mode في Network tab
اختبار Lighthouse:
F12 → Lighthouse
اختر Progressive Web App
اضغط Generate report
الهدف: نتيجة 100/100
📋 قائمة التحقق قبل النشر
 تعديل رقم WhatsApp في js/app.js
 تعديل رابط GitHub في js/updates.js
 إنشاء جميع أحجام الأيقونات
 اختبار التسجيل
 اختبار عرض الدروس
 اختبار إرسال الإجابة عبر WhatsApp
 اختبار نظام التحديثات
 اختبار وضع Offline
 اختبار على هاتف حقيقي
 رفع على GitHub Pages
 اختبار Lighthouse PWA
📄 الترخيص
هذا المشروع مفتوح المصدر للاستخدام التعليمي.

👨‍💻 المطور
تم تطويره لأغراض تعليمية —  أولمبياد الفيزياء والكيمياء 2025

text


---

> ✅ الملف الحادي عشر جاهز.
>
> هذا هو **`README.md`** — الدليل الشامل الذي يحتوي على:
> - **هيكلة المشروع** الكاملة بشكل بصري
> - **تعليمات إنشاء الأيقونات** بـ 3 طرق مختلفة
> - **جدول أحجام الأيقونات** المطلوبة
> - **خطوات الإعداد والتشغيل** المحلي
> - **تعليمات GitHub Pages** للنشر
> - **تعليمات Capacitor** الكاملة للتحويل إلى Android/iOS
> - **كيفية إضافة دروس وتمارين** جديدة
> - **قائمة تحقق** قبل النشر
>
> اكتب **"التالي"** للانتقال إلى `generate-icons.html` — أداة توليد أيقونات مؤقتة 🎨