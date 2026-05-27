<div align="center">

# CORSY

**Private messenger with invite-only access**

[![TypeScript](https://img.shields.io/badge/TypeScript-98%25-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-e0234e?style=flat-square&logo=nestjs)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React Native](https://img.shields.io/badge/React_Native-Expo-0ea5e9?style=flat-square&logo=expo)](https://expo.dev/)
[![Live](https://img.shields.io/badge/Live-connexy--com--frontend.vercel.app-6366f1?style=flat-square)](https://connexy-com-frontend.vercel.app)

</div>

---

## About

Corsy is a full-featured messenger with invites, group rooms, video calls, and end-to-end encryption. The project went through a full cycle: security audit → vulnerability fixes → feature development → production deployment.

**Three platforms from a single monorepo:** web (Next.js), backend (NestJS), and a mobile app (Expo).

---

## Tech stack

### Backend
| | |
|---|---|
| **Runtime** | Node.js + NestJS 10 |
| **Database** | PostgreSQL + Prisma ORM |
| **Auth** | JWT (access + refresh rotation), 2FA (TOTP), backup codes |
| **Real-time** | Socket.io (WebSocket) |
| **Email** | Nodemailer (SMTP) |
| **Files** | Cloudinary |
| **Payments** | Stripe (FREE / PRO / TEAM plans) |
| **SFU calls** | LiveKit (fallback: WebRTC Mesh P2P) |
| **Deploy** | Render |

### Frontend
| | |
|---|---|
| **Framework** | Next.js 14 (App Router) |
| **UI** | TailwindCSS |
| **State** | Zustand |
| **Real-time** | Socket.io-client |
| **Calls** | WebRTC (P2P Mesh + LiveKit SFU) |
| **Deploy** | Vercel |

### Mobile
| | |
|---|---|
| **Framework** | React Native + Expo SDK 56 |
| **Navigation** | Expo Router |
| **Storage** | expo-secure-store (Keychain / Keystore) |
| **Crypto** | tweetnacl + expo-crypto |

---

## Security architecture

The project went through a **security audit** — 6 critical issues were found and fixed:

| # | Issue | Fix |
|---|---|---|
| 1 | DM could be sent to any user without contact check | Validate Connection before sending |
| 2 | WebSocket room subscription without membership check | Validate RoomMember in handleJoinRoom |
| 3 | Unlimited email code resends | Rate limiting (DB + express-rate-limit) |
| 4 | attachmentUrl without domain validation | Cloudinary allowlist |
| 5 | Invite tokens stored in plaintext | Store only SHA-256 hash |
| 6 | Email verification codes stored in plaintext | SHA-256 hashing of codes |

### E2E encryption

- **Algorithm:** X25519 Diffie-Hellman + XSalsa20-Poly1305 (NaCl Box, tweetnacl)
- **Keys:** generated on-device; the private key never leaves the client
- **Storage:** private key is encrypted with a master key (PBKDF2 on web, SHA-256 on mobile) and stored in localStorage / Keychain
- **Format:** `e2e:{nonce_hex}:{ciphertext_base64}` — the server stores ciphertext and cannot decrypt it
- **Indicator:** `🔐 E2E` badge in the chat header when both parties have keys

---

## Features

### Messaging
- ✅ Direct messages (DM) — contacts only
- ✅ Password-protected group rooms (TTL 10 days)
- ✅ Message editing (24h window)
- ✅ Message deletion
- ✅ Reply / Quote
- ✅ Emoji reactions (toggle, max 20 per message)
- ✅ Attachments (Cloudinary)
- ✅ Message search
- ✅ Typing indicator
- ✅ Read receipts

### Calls
- ✅ 1:1 video and voice calls (WebRTC)
- ✅ Group calls (WebRTC Mesh up to 6 participants)
- ✅ Group calls via SFU (LiveKit, scales to 200+)
- ✅ Screen sharing
- ✅ Incoming call UI with ringtone (Web Audio API)
- ✅ 45s no-answer timeout

### Authentication
- ✅ Invite-only registration
- ✅ Email verification (6-digit code, SHA-256 hash in DB)
- ✅ 2FA — TOTP (Google Authenticator, Authy)
- ✅ Backup codes (80-bit entropy, format XXXXX-XXXXX-XXXXX-XXXXX)
- ✅ Refresh token rotation + family invalidation
- ✅ Up to 10 active devices per account
- ✅ Waitlist with admin management

### Notifications
- ✅ Web Push notifications (VAPID)
- ✅ In-app toast for incoming calls
- ✅ Push on group-call start (offline members)

### Admin
- ✅ Platform statistics
- ✅ Users list with search and pagination
- ✅ Change user plan
- ✅ Audit log with severity filtering

### Plans and limits
| Feature | FREE | PRO | TEAM |
|---|---|---|---|
| Contacts | 10 | 100 | Unlimited |
| Active rooms | 1 | 5 | 20 |
| Room members | 10 | 50 | 200 |
| Monthly invites | 3 | 25 | 100 |

---

## Local development

### Requirements
- Node.js 18+
- PostgreSQL

### Setup

```bash
# Clone the repository
git clone https://github.com/Tim124v/Connexy.com.git
cd Connexy.com

# Install dependencies
npm install

# Generate Prisma client
cd backend && npx prisma generate && cd ..
```

### Environment

Copy `.env.example` to `backend/.env` and fill it in:

```bash
cp backend/.env.example backend/.env
```

Minimal set for local run:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/corsy
JWT_SECRET=your-secret-key-min-32-chars
FRONTEND_URL=http://localhost:3000
```

### Migrations and run

```bash
# Apply migrations
cd backend && npx prisma migrate deploy && cd ..

# Start backend + frontend
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### First user (bootstrap)

To register the first admin user, set in `backend/.env`:
```env
BOOTSTRAP_INVITE_TOKEN=any-secret-token
```
Use this token as the invite during registration.

---

## Deployment

### Backend — Render

```yaml
Build: npm install --include=dev && npx prisma generate && npm run build
Start: npx prisma migrate deploy && node dist/main.js
```

Required environment variables on Render:
```
DATABASE_URL=...
JWT_SECRET=...
CORS_ORIGIN=https://your-frontend.vercel.app
FRONTEND_URL=https://your-frontend.vercel.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
```

### Frontend — Vercel

```
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

### Mobile — Expo

```bash
cd mobile
npm install
npx expo start
```

For a physical device, set your server IP in `mobile/app.json`:
```json
"extra": { "apiUrl": "http://192.168.1.100:3001" }
```

---

## WebRTC and TURN

For reliable calls behind NAT you need a TURN server.

**Quick option (free):**
```env
NEXT_PUBLIC_TURN_URLS=turn:openrelay.metered.ca:80
NEXT_PUBLIC_TURN_USERNAME=openrelayproject
NEXT_PUBLIC_TURN_CREDENTIAL=openrelayproject
```

**Production (paid):** [metered.ca](https://www.metered.ca/)

---

## LiveKit SFU (group calls >6 participants)

```env
LIVEKIT_API_KEY=APIxxxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxx
LIVEKIT_URL=wss://your-project.livekit.cloud
```

Without LiveKit the app falls back to WebRTC Mesh automatically (up to 6 participants).

---

## Project structure

```
Corsy.com/
├── backend/          # NestJS API
│   ├── src/
│   │   ├── auth/     # JWT, 2FA, email verification
│   │   ├── chat/     # WebSocket gateway, WebRTC signaling
│   │   ├── messages/ # DM, E2E, reactions, search
│   │   ├── rooms/    # Group rooms, LiveKit tokens
│   │   ├── users/    # Profile, E2E public keys
│   │   ├── security/ # Encryption, audit log, token refresh
│   │   └── ...
│   └── prisma/       # Schema + migrations
├── frontend/         # Next.js 14 web app
│   ├── app/          # App Router pages
│   ├── hooks/        # useWebRTC, useGroupWebRTC, useLiveKit, useE2E
│   ├── store/        # Zustand stores
│   └── lib/          # API client, E2E crypto
└── mobile/           # React Native (Expo)
    ├── app/          # Expo Router pages
    ├── hooks/        # use-e2e (mobile)
    ├── lib/          # API client, e2e-crypto-mobile
    └── store/        # Auth store (SecureStore)
```

---

<div align="center">
Made with ❤️ · <a href="https://connexy-com-frontend.vercel.app">Live Demo</a>
</div>
<div align="center">

# CORSY

**Приватный мессенджер с invite-only доступом**

[![TypeScript](https://img.shields.io/badge/TypeScript-98%25-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-e0234e?style=flat-square&logo=nestjs)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React Native](https://img.shields.io/badge/React_Native-Expo-0ea5e9?style=flat-square&logo=expo)](https://expo.dev/)
[![Live](https://img.shields.io/badge/Live-connexy--com--frontend.vercel.app-6366f1?style=flat-square)](https://connexy-com-frontend.vercel.app)

</div>

---

## О проекте

Corsy — полноценный мессенджер с приглашениями, групповыми комнатами, видеозвонками и end-to-end шифрованием. Проект прошёл полный цикл: security audit → исправление уязвимостей → разработка фич → деплой на продакшн.

**Три платформы из одного монорепо:** веб (Next.js), backend (NestJS), мобильное приложение (Expo).

---

## Стек

### Backend
| | |
|---|---|
| **Runtime** | Node.js + NestJS 10 |
| **База данных** | PostgreSQL + Prisma ORM |
| **Аутентификация** | JWT (access + refresh rotation), 2FA (TOTP), backup-коды |
| **Real-time** | Socket.io (WebSocket) |
| **Email** | Nodemailer (SMTP) |
| **Файлы** | Cloudinary |
| **Платежи** | Stripe (FREE / PRO / TEAM планы) |
| **Звонки SFU** | LiveKit (fallback: WebRTC Mesh P2P) |
| **Деплой** | Render |

### Frontend
| | |
|---|---|
| **Framework** | Next.js 14 (App Router) |
| **UI** | TailwindCSS |
| **State** | Zustand |
| **Real-time** | Socket.io-client |
| **Звонки** | WebRTC (P2P Mesh + LiveKit SFU) |
| **Деплой** | Vercel |

### Mobile
| | |
|---|---|
| **Framework** | React Native + Expo SDK 56 |
| **Навигация** | Expo Router |
| **Хранилище** | expo-secure-store (Keychain / Keystore) |
| **Крипто** | tweetnacl + expo-crypto |

---

## Архитектура безопасности

Проект прошёл **security audit** — было найдено и закрыто 6 критических уязвимостей:

| # | Уязвимость | Исправление |
|---|---|---|
| 1 | Отправка DM любому пользователю без проверки контактов | Проверка Connection перед отправкой |
| 2 | Подписка на WS-комнату без проверки членства | Проверка RoomMember в handleJoinRoom |
| 3 | Неограниченный resend email кода | Rate limit (БД + express-rate-limit) |
| 4 | attachmentUrl без валидации домена | Whitelist Cloudinary |
| 5 | Токены инвайтов в plaintext в БД | Хранение только SHA-256 хеша |
| 6 | Email verification коды в plaintext | SHA-256 хеширование кодов |

### E2E шифрование

- **Алгоритм:** X25519 Diffie-Hellman + XSalsa20-Poly1305 (NaCl Box, библиотека tweetnacl)
- **Ключи:** генерируются на устройстве, приватный ключ никогда не покидает клиента
- **Хранение:** приватный ключ зашифрован master-key (PBKDF2 на web, SHA-256 на mobile), хранится в localStorage / Keychain
- **Формат:** `e2e:{nonce_hex}:{ciphertext_base64}` — сервер хранит ciphertext и не может расшифровать
- **Индикатор:** `🔐 E2E` в шапке чата когда оба участника настроили ключи

---

## Функциональность

### Сообщения
- ✅ Личные чаты (DM) — только между контактами
- ✅ Групповые комнаты с паролем (TTL 10 дней)
- ✅ Редактирование сообщений (окно 24 часа)
- ✅ Удаление сообщений
- ✅ Reply / Quote — ответ на сообщение
- ✅ Реакции emoji (toggle, лимит 20 на сообщение)
- ✅ Вложения (Cloudinary)
- ✅ Поиск по переписке
- ✅ Индикатор печати
- ✅ Статус прочтения

### Звонки
- ✅ Видео и голосовые 1:1 звонки (WebRTC)
- ✅ Групповые звонки (WebRTC Mesh до 6 участников)
- ✅ Групповые звонки через SFU (LiveKit, масштабируется до 200+)
- ✅ Screen sharing
- ✅ Красивый UI входящего звонка с рингтоном (Web Audio API)
- ✅ Таймаут 45 сек без ответа

### Аутентификация
- ✅ Регистрация только по инвайт-ссылке (invite-only)
- ✅ Email верификация (6-значный код, SHA-256 хеш в БД)
- ✅ 2FA — TOTP (Google Authenticator, Authy)
- ✅ Backup-коды (80 бит энтропии, формат XXXXX-XXXXX-XXXXX-XXXXX)
- ✅ Refresh token rotation + family invalidation
- ✅ До 10 активных устройств на аккаунт
- ✅ Вейтлист с admin-управлением

### Уведомления
- ✅ Web Push уведомления (VAPID)
- ✅ In-app toast при входящем звонке
- ✅ Push при начале группового звонка (для оффлайн-участников)

### Admin панель
- ✅ Статистика платформы
- ✅ Список пользователей с поиском и пагинацией
- ✅ Смена плана пользователя
- ✅ Журнал аудита с фильтрацией по severity

### Планы и ограничения
| Функция | FREE | PRO | TEAM |
|---|---|---|---|
| Контакты | 10 | 100 | Безлимит |
| Активные комнаты | 1 | 5 | 20 |
| Участников в комнате | 10 | 50 | 200 |
| Инвайтов в месяц | 3 | 25 | 100 |

---

## Запуск локально

### Требования
- Node.js 18+
- PostgreSQL

### Установка

```bash
# Клонировать репозиторий
git clone https://github.com/Tim124v/Connexy.com.git
cd Connexy.com

# Установить зависимости
npm install

# Сгенерировать Prisma клиент
cd backend && npx prisma generate && cd ..
```

### Настройка окружения

Скопируй `.env.example` в `backend/.env` и заполни:

```bash
cp backend/.env.example backend/.env
```

Минимальный набор для локального запуска:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/corsy
JWT_SECRET=your-secret-key-min-32-chars
FRONTEND_URL=http://localhost:3000
```

### Миграции и запуск

```bash
# Применить миграции
cd backend && npx prisma migrate deploy && cd ..

# Запустить backend + frontend
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### Первый пользователь (bootstrap)

Для регистрации первого admin-пользователя задай в `backend/.env`:
```env
BOOTSTRAP_INVITE_TOKEN=любой-секретный-токен
```
Используй этот токен как инвайт при регистрации.

---

## Деплой

### Backend — Render

```yaml
Build: npm install --include=dev && npx prisma generate && npm run build
Start: npx prisma migrate deploy && node dist/main.js
```

Обязательные переменные окружения на Render:
```
DATABASE_URL=...
JWT_SECRET=...
CORS_ORIGIN=https://your-frontend.vercel.app
FRONTEND_URL=https://your-frontend.vercel.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
```

### Frontend — Vercel

```
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

### Mobile — Expo

```bash
cd mobile
npm install
npx expo start
```

Для реального устройства задай IP сервера в `mobile/app.json`:
```json
"extra": { "apiUrl": "http://192.168.1.100:3001" }
```

---

## WebRTC и TURN

Для надёжных звонков за NAT нужен TURN-сервер.

**Быстрый вариант (бесплатно):**
```env
NEXT_PUBLIC_TURN_URLS=turn:openrelay.metered.ca:80
NEXT_PUBLIC_TURN_USERNAME=openrelayproject
NEXT_PUBLIC_TURN_CREDENTIAL=openrelayproject
```

**Production (платно):** [metered.ca](https://www.metered.ca/)

---

## LiveKit SFU (групповые звонки >6 человек)

```env
LIVEKIT_API_KEY=APIxxxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxx
LIVEKIT_URL=wss://your-project.livekit.cloud
```

Без LiveKit — автоматический fallback на WebRTC Mesh (до 6 участников).

---

## Структура проекта

```
Corsy.com/
├── backend/          # NestJS API
│   ├── src/
│   │   ├── auth/     # JWT, 2FA, email verification
│   │   ├── chat/     # WebSocket gateway, WebRTC signaling
│   │   ├── messages/ # DM, E2E, reactions, search
│   │   ├── rooms/    # Group rooms, LiveKit tokens
│   │   ├── users/    # Profile, E2E public keys
│   │   ├── security/ # Encryption, audit log, token refresh
│   │   └── ...
│   └── prisma/       # Schema + migrations
├── frontend/         # Next.js 14 web app
│   ├── app/          # App Router pages
│   ├── hooks/        # useWebRTC, useGroupWebRTC, useLiveKit, useE2E
│   ├── store/        # Zustand stores
│   └── lib/          # API client, E2E crypto
└── mobile/           # React Native (Expo)
    ├── app/          # Expo Router pages
    ├── hooks/        # use-e2e (mobile)
    ├── lib/          # API client, e2e-crypto-mobile
    └── store/        # Auth store (SecureStore)
```

---

<div align="center">
Made with ❤️ · <a href="https://connexy-com-frontend.vercel.app">Live Demo</a>
</div>
