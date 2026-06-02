# Duffel Flight Booker

هذا المشروع عبارة عن workspace pnpm متعدد الحزم. لا يوجد أمر `dev:all` في الجذر؛ التشغيل يكون عبر خدمتين منفصلتين في طرفيتين.

## المتطلبات

- Node.js 24
- pnpm
- ملف `.env` في الجذر يحتوي على الأقل على:
  - `PORT=5000`
  - `BASE_PATH=/`
  - `API_PORT=3000`
  - `DATABASE_URL=...`
  - `DUFFEL_ACCESS_TOKEN=...`

## التشغيل المحلي

1. تثبيت الحزم:

```bash
pnpm install --ignore-scripts
```

2. تشغيل الـ API:

```bash
pnpm --filter @workspace/api-server run dev
```

3. تشغيل الواجهة الأمامية:

```bash
pnpm --filter @workspace/flight-booking run dev
```

بعدها ستكون الواجهة على `http://localhost:5000` والـ API على `http://localhost:3000`.

## أوامر مفيدة

```bash
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
```

## evolution-api

لتشغيل سيرفر Evolution API داخل نفس الـ workspace:

```bash
pnpm --dir evolution-api run dev:server
```

هذا السيرفر يعتمد على ملف البيئة الخاص به داخل `evolution-api` وقد يستخدم إعدادات قاعدة البيانات والـ provider الخاصة بالمشروع.