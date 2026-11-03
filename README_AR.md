# التحول الرقمي V10 — Vercel + Android

هذه النسخة تعمل مباشرة كواجهة Web على Vercel ويمكن تغليفها كتطبيق Android بواسطة Capacitor.

## الحسابات التجريبية
- التحول الرقمي: admin@tahawol.local / 123456
- الموظف: employee@tahawol.local / 123456

## مهم عن البيانات المؤقتة
هذه النسخة تستخدم تخزيناً تجريبياً محلياً داخل المتصفح/التطبيق (localStorage) حتى تعمل فوراً بدون قاعدة بيانات أو مفاتيح سرية. لذلك البيانات لا تتزامن بين جهازين مختلفين. Vercel يستضيف التطبيق فقط. عند الانتقال للاستخدام المركزي الحقيقي اربط Supabase/PostgreSQL أو قاعدة بيانات دائمة.

## رفعه على Vercel
1. افتح CMD داخل هذا المجلد.
2. نفّذ: npm install
3. نفّذ: npx vercel
4. وافق على تسجيل الدخول ثم إعداد المشروع.
5. للنشر النهائي: npx vercel --prod
سيظهر رابط https عام يعمل من الهاتف.

بديل: ارفع هذا المجلد إلى GitHub ثم Import Project من Vercel. إعدادات البناء لا تحتاج Framework؛ Output Directory هو www.

## إنشاء مشروع Android / APK
يتطلب Android Studio + Android SDK بالإضافة إلى Node.js.
1. npm install
2. npx cap add android
3. npx cap sync android
4. npx cap open android
5. داخل Android Studio: Build > Generate App Bundles or APKs > Generate APKs

للتجربة السريعة يمكن اختيار Build APK. للنشر الرسمي استخدم Signed APK/AAB ومفتاح توقيع محفوظ بأمان.

## بعد تعديل ملفات www
نفّذ: npx cap sync android
ثم أعد البناء من Android Studio.

# V10.1 - البناء على Codemagic

هذه النسخة تحتوي على `codemagic.yaml` في جذر المشروع لبناء APK تجريبي قابل للتثبيت تلقائياً في Codemagic.

## الخطوات
1. ارفع **محتويات هذا المجلد** إلى مستودع GitHub، ويجب أن يكون `codemagic.yaml` في جذر المستودع بجانب `package.json`.
2. افتح Codemagic وسجل الدخول، ثم اختر **Add application** واربط مستودع GitHub.
3. اطلب من Codemagic فحص `codemagic.yaml` ثم اختر workflow باسم:
   `Tahawol Digital - Android APK`
4. اضغط **Start new build**.
5. عند نجاح البناء افتح قسم **Artifacts** وحمّل `app-debug.apk`.

## ملاحظة
هذا APK هو Debug وموقّع تلقائياً بمفتاح Debug، لذلك هو مناسب للتثبيت والاختبار على الهاتف. للنشر على Google Play نحتاج لاحقاً Release signing/keystore ويفضل إخراج AAB.
