Приватные связи: контакты, приглашения по ссылке, чаты.

**Стек:** Backend — NestJS, Prisma (Postgres), JWT. Frontend — Next.js 14, TailwindCSS, Zustand.

**Возможности:** регистрация с подтверждением email, логин, личный кабинет, приглашения по ссылке, чаты и комнаты.


## Email verification (подтверждение email)

Регистрация проходит в два шага:

1. **Регистрация** — пользователь вводит email, пароль и подтверждение пароля. Бэкенд создаёт запись пользователя (`isVerified: false`), генерирует 6-значный код, сохраняет его в таблице `EmailVerification` (срок действия 10 минут) и отправляет письмо на email через SMTP.
2. **Подтверждение** — пользователь переходит на страницу `/auth/verify-email`, вводит код из письма. При успешной проверке пользователь помечается как `isVerified: true`, создаётся сессия (JWT), выполняется редирект в дашборд.

Если код не пришёл, на странице подтверждения есть кнопка **«Отправить ещё раз»** — она запрашивает новый код (старый код становится недействительным).

**Безопасность:**

- Пароль хранится в виде bcrypt-хеша.
- Код подтверждения действителен 10 минут.
- Ограничение: не более 5 попыток ввода кода за 10 минут (по email).
- Вход возможен только для пользователей с подтверждённым email.

---

## Переменные окружения

### Backend (`backend/.env` или корневой `.env`)

| Переменная      | Описание |
|-----------------|----------|
| `DATABASE_URL`  | Строка подключения PostgreSQL. |
| `JWT_SECRET`    | Секрет для подписи JWT. |
| `JWT_EXPIRES_IN`| Срок жизни токена (например `7d`). |
| `FRONTEND_URL`  | URL фронтенда (для ссылок в письмах). |
| `SMTP_HOST`     | Хост SMTP для отправки писем (подтверждение email, приглашения). |
| `SMTP_PORT`     | Порт SMTP (например 587). |
| `SMTP_USER`     | Логин SMTP. |
| `SMTP_PASS`     | Пароль SMTP. |
| `SMTP_FROM`     | Адрес отправителя в письмах. |

Если SMTP не задан, регистрация и приглашения по-прежнему работают, но письма с кодом не отправляются (код можно смотреть в логах бэкенда при разработке).

### Frontend (`frontend/.env.local`)

| Переменная             | Описание |
|------------------------|----------|
| `NEXT_PUBLIC_API_URL`  | URL бэкенда (например `http://localhost:3001`). |

---

## Запуск локально

1. Установить зависимости и сгенерировать Prisma-клиент:

   ```bash
   npm install
   cd backend && npx prisma generate && cd ..
   ```

2. Настроить `backend/.env`: указать `DATABASE_URL` (PostgreSQL на `localhost` или облако; для Render часто нужен суффикс `?sslmode=require`). Убедитесь, что сервер БД запущен и доступен по этому URL. Затем применить миграции (на пустой БД создаётся полная схема одной baseline-миграцией):

   ```bash
   cd backend && npx prisma migrate deploy && cd ..
   ```

3. Запустить backend и frontend:

   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:3000  
   - Backend: http://localhost:3001  

4. Регистрация: http://localhost:3000/auth/register → после ввода данных редирект на `/auth/verify-email?email=...`. Код из письма (или из логов бэкенда, если SMTP не настроен) ввести на странице подтверждения.

---

## WebRTC звонки и TURN-сервер

Видео и голосовые звонки используют WebRTC P2P. Для установки соединения нужен STUN-сервер (Google STUN используется по умолчанию, бесплатно).

**Проблема:** STUN не работает за Symmetric NAT — корпоративные сети, часть мобильных операторов. Для надёжных звонков нужен TURN-сервер.

### Варианты настройки TURN

**Вариант A — Бесплатный Open Relay (Metered.ca, до 500MB/мес):**

```env
NEXT_PUBLIC_TURN_URLS=turn:openrelay.metered.ca:80,turn:openrelay.metered.ca:443?transport=tcp,turns:openrelay.metered.ca:443?transport=tcp
NEXT_PUBLIC_TURN_USERNAME=openrelayproject
NEXT_PUBLIC_TURN_CREDENTIAL=openrelayproject
```

**Вариант B — Платный Metered.ca (рекомендуется для production):**

Зарегистрируйтесь на https://www.metered.ca/, создайте приложение, получите credentials.

**Вариант C — Свой coturn:**

Установите [coturn](https://github.com/coturn/coturn), задайте те же три переменные в `frontend/.env.local`.

**Вариант D — Полный JSON список ICE (несколько TURN серверов):**

```env
NEXT_PUBLIC_WEBRTC_ICE_SERVERS_JSON=[{"urls":["turn:your.host:3478"],"username":"u","credential":"p"}]
```

### Без TURN

Без TURN звонки работают только между пользователями в одной сети или если хотя бы один из них имеет публичный IP. Приложение запустится, но часть звонков может не соединиться. В dev-консоли будет предупреждение.

---

## SFU для групповых звонков >6 участников (LiveKit)

По умолчанию групповые звонки используют WebRTC Mesh (P2P) — хорошо до 6 участников.
Для комнат с большим количеством участников нужен SFU (Selective Forwarding Unit).

### Настройка LiveKit Cloud (рекомендуется)

1. Зарегистрируйтесь на [livekit.io](https://livekit.io) → Create Project
2. Скопируйте API Key, API Secret, WebSocket URL из Dashboard
3. Добавьте в `backend/.env`:
   ```
   LIVEKIT_API_KEY=APIxxxxxxxxxxxxxxx
   LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   LIVEKIT_URL=wss://your-project.livekit.cloud
   ```

### Поведение

| Ситуация | Режим |
|----------|-------|
| LiveKit настроен | SFU (все групповые звонки через LiveKit) |
| LiveKit не настроен | Mesh P2P (предупреждение при >6 уч.) |

### Самостоятельный деплой LiveKit

Если нужен self-hosted:
```bash
docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  -e LIVEKIT_KEYS="devkey: secret" \
  livekit/livekit-server --dev
```
Затем: `LIVEKIT_API_KEY=devkey`, `LIVEKIT_API_SECRET=secret`, `LIVEKIT_URL=ws://localhost:7880`
