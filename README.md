# Admin Menu

Онлайн-тесты с админ-панелью и уведомлениями в Telegram. Один Node.js-сервис: публичный сайт, админка и бот (webhook) — всё вместе, без отдельных фронтенд- и бот-сервисов.

- **Сайт:** список опубликованных тестов, ввод имени, прохождение, страница «Спасибо».
- **Админка:** вход по логину/паролю, создание и редактирование тестов, публикация, удаление, результаты с детализацией и экспорт в CSV.
- **Telegram:** результат приходит в чат сразу после прохождения.
- **База:** PostgreSQL (Aiven или Neon) через Prisma, миграции применяются автоматически при старте.

---

## Стек и почему так

| Слой | Технология |
| --- | --- |
| Хостинг | Render Web Service (Free) |
| База | PostgreSQL: Aiven Free (рекомендуется) или Neon (`DATABASE_URL`) |
| Backend | Node.js 20+ / Express 5 |
| ORM | Prisma 6 + миграции в репозитории |
| Frontend | EJS (серверные шаблоны) + свой CSS/JS |
| Бот | grammY, режим webhook |
| Аутентификация | express-session + bcrypt (`bcryptjs`), один админ из env |

**Почему EJS, а не React/Vite.** Один Web Service на Free-тарифе: серверные шаблоны отдают готовый HTML без второго контейнера, сборки фронтенда и проксирования API. Это меньше памяти (512 MB), меньше точек отказа и один шаг деплоя. React через Vite потребовал бы отдельного Static Site либо сборки в тот же сервис — для этой задачи выгоды нет.

**Почему `bcryptjs`.** Это тот же алгоритм bcrypt (хеши `$2b$` совместимы), но без нативной компиляции при установке на Render. Меньше шансов, что сборка упадёт.

**Prisma зафиксирована на 6.19.3.** На момент сборки тег `latest` у Prisma указывает на 8.0.0-rc, поэтому версии зафиксированы явно.

---

## Структура проекта

```
admin-menu/
├── prisma/
│   ├── schema.prisma                  # модели Test, Question, AnswerOption, Submission, SubmissionAnswer
│   └── migrations/20260101000000_init/ # готовые SQL-миграции (+ таблица сессий)
├── public/                            # styles.css, admin.js, test.js, ui.js, favicon.svg
├── scripts/hash-password.js            # генератор ADMIN_PASSWORD_HASH
├── scripts/start.js                    # проверка env → миграции → сервер
├── src/
│   ├── config.js                      # чтение и проверка env
│   ├── prisma.js                      # Prisma Client
│   ├── server.js                      # Express, сессии, helmet, маршруты, запуск
│   ├── lib/                           # форматирование, подсчёт, валидация формы, Telegram
│   ├── middleware/                    # auth, csrf
│   └── routes/                        # public, admin, telegram webhook
├── views/                             # EJS-шаблоны (публичные + admin/)
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── render.yaml
```

---

## Шаг 0. Репозиторий

Проект уже создан и запушен на GitHub. Дальнейшие изменения:

1. Откройте GitHub Desktop → **File → Add local repository…** → папка `admin-menu` (если ещё не добавлена).
2. Введите Summary → **Commit to main**.
3. **Push origin** — Render подхватит коммит автоматически (`autoDeploy: true`).

> `.gitignore` исключает `node_modules`, `.env`, логи и сборку. Секретов в репозитории нет.

---

## Шаг 1. Локальный запуск

Нужен Node.js 20 или новее (`node -v`).

```bash
npm ci
cp .env.example .env
```

Откройте `.env` и заполните минимум:

```env
DATABASE_URL="postgresql://avnadmin:ПАРОЛЬ@pg-xxx.aivencloud.com:12345/defaultdb?sslmode=require"
SESSION_SECRET="любая-длинная-случайная-строка"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD_HASH="$2b$12$..."
TELEGRAM_BOT_TOKEN="123456:AA..."
TELEGRAM_CHAT_ID="123456789"
WEBHOOK_URL="http://localhost:3000"
TELEGRAM_WEBHOOK_SECRET="случайный-секрет"
NODE_ENV=development
TZ=Europe/Moscow
```

Сгенерировать секреты и хеш пароля:

```bash
# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# TELEGRAM_WEBHOOK_SECRET (можно любую длинную строку)
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"

# ADMIN_PASSWORD_HASH
npm run hash -- "ваш-пароль"
```

Запуск:

```bash
npm run dev
```

Откройте:

- сайт — http://localhost:3000
- админка — http://localhost:3000/admin/login

`npm run dev` сначала выполняет `prisma migrate deploy` (создаёт таблицы в Aiven/Neon), затем запускает сервер с авто-перезагрузкой.

> Локально `WEBHOOK_URL` можно оставить пустым — сайт и уведомления в Telegram будут работать, просто бот не зарегистрирует webhook (Telegram не сможет достучаться до localhost). Для локальной проверки самого webhook используйте туннель (ngrok/cloudflared) и укажите его URL.

### Скрипты

| Команда | Что делает |
| --- | --- |
| `npm run dev` | миграции + сервер с watch |
| `npm start` | проверка env → миграции → сервер (так запускает Render) |
| `npm run build` | `prisma generate` |
| `npm run db:deploy` | применить миграции вручную |
| `npm run db:status` | статус миграций |
| `npm run db:studio` | Prisma Studio (локальный просмотр базы) |
| `npm run hash -- "пароль"` | bcrypt-хеш для `ADMIN_PASSWORD_HASH` |

---

## Шаг 2. База данных: Aiven (бесплатно, без карты)

Aiven Free — managed PostgreSQL: 1 ГБ диска, 1 ГБ RAM, без карты и без ограничения по времени. На free-плане сервис могут выключать после простоя — включается кнопкой **Power on** в консоли.

### Регистрация и создание базы (2–5 минут)

1. Откройте [aiven.io](https://aiven.io) → **Sign up** (Google/GitHub/email). Карта не нужна.
2. В Console → **Create service**.
3. Выберите **PostgreSQL** → план **Free** → регион ближе к Render (например, `Frankfurt`) → имя `admin-menu-db` → **Create service**.
4. Дождитесь статуса **Running** (обычно 2–5 минут).

### Где взять DATABASE_URL

1. Откройте сервис → вкладка **Overview**.
2. Найдите **Service URI** → нажмите **Copy** (пароль скрыт точками — нажмите значок глаза, чтобы увидеть).
3. Строка выглядит так:

```text
postgresql://avnadmin:ПАРОЛЬ@pg-xxxx-admin-menu-db.aivencloud.com:12345/defaultdb?sslmode=require
```

Это и есть `DATABASE_URL`. Параметр `?sslmode=require` уже есть — добавлять ничего не нужно.

> Aiven требует TLS. `sslmode=require` достаточно, CA-сертификат скачивать не нужно. Не включайте connection pooling — на free-плане его нет, используйте Service URI напрямую. IP-фильтр не настраивайте: по умолчанию Aiven принимает подключения с любого IP, а у Render адреса динамические. Лимит подключений на free — 20; приложение держит около 6, этого достаточно.

Схема создаётся автоматически при первом запуске (`prisma migrate deploy`). Ручной SQL не нужен. Схему Prisma менять не нужно: Aiven — обычный PostgreSQL, `sslmode=require` поддерживается из коробки (и Prisma, и пулом сессий).

### Если сервис выключился

Free-план Aiven может уходить в сон после простоя (приходит письмо). В Console у сервиса будет статус **Powered off** → нажмите **Power on** и подождите 1–2 минуты. Приложение в это время отвечает ошибкой `P1001`.

### Альтернатива: Neon

1. [neon.tech](https://neon.tech) → **New Project** → **Connect**.
2. **Direct connection** (хост без `-pooler`), скопируйте строку `postgresql://...?sslmode=require`.
3. Вставьте её в `DATABASE_URL` вместо строки Aiven.

### Альтернатива: Supabase

Project → Settings → Database → Connection string → URI, прямой порт `5432`, добавьте `?sslmode=require`. Пулер `6543` для миграций не подходит.

> Встроенный Render PostgreSQL не используем: на Free он удаляется через 30 дней.

---

## Шаг 3. Telegram-бот

1. В Telegram откройте [@BotFather](https://t.me/BotFather) → `/newbot`.
2. Задайте имя и username бота (username обязан заканчиваться на `bot`).
3. BotFather пришлёт токен вида `123456789:AAH...` — это `TELEGRAM_BOT_TOKEN`.
4. Напишите своему боту `/start` — он ответит: `Ваш chat_id: 123456789`. Это `TELEGRAM_CHAT_ID`.

Если результаты нужны в канале:

1. Добавьте бота в канал и сделайте администратором (право публиковать сообщения).
2. Отправьте в канал любое сообщение или перешлите сообщение из канала боту [@userinfobot](https://t.me/userinfobot) / [@getidsbot](https://t.me/getidsbot) — получите id вида `-1001234567890`.
3. Вставьте этот id в `TELEGRAM_CHAT_ID` (минус в начале обязателен).

5. Придумайте `TELEGRAM_WEBHOOK_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

6. `WEBHOOK_URL` задавать не обязательно: на Render приложение берёт `RENDER_EXTERNAL_URL` автоматически. Укажите его только для своего домена (без слэша на конце). При старте приложение само вызывает `setWebhook` на `<URL>/api/telegram/webhook` с секретным токеном.

Проверить, что webhook установлен: откройте в браузере

```text
https://api.telegram.org/bot<ТОКЕН>/getWebhookInfo
```

Должны быть `"url": "https://.../api/telegram/webhook"` и `"last_error_message"` без ошибок. Ссылку с токеном никому не отправляйте.

---

## Шаг 4. Деплой на Render (Blueprint)

1. Запушьте проект в GitHub (GitHub Desktop → **Publish repository** / **Push origin**).
2. Зайдите на [render.com](https://render.com) → **New → Blueprint**.
3. Подключите GitHub и выберите репозиторий `admin-menu`. Render прочитает `render.yaml`.
4. Render покажет сервис `admin-menu` и переменные, которые нужно заполнить вручную (`sync: false`). Вставьте:

| Переменная | Значение |
| --- | --- |
| `DATABASE_URL` | Service URI из Aiven (или строка Neon) |
| `ADMIN_USERNAME` | логин админа, например `admin` |
| `ADMIN_PASSWORD_HASH` | bcrypt-хеш из `npm run hash -- "пароль"` |
| `TELEGRAM_BOT_TOKEN` | токен из BotFather |
| `TELEGRAM_CHAT_ID` | ваш chat_id или id канала |
`SESSION_SECRET` Render сгенерирует сам (`generateValue: true`), но только если сервис создан через Blueprint. Если сервис создавался вручную (New → Web Service), `render.yaml` не применяется — добавьте `SESSION_SECRET` в Environment вручную: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. После добавления не меняйте значение, иначе сессии админки сбросятся. `WEBHOOK_URL` и `TELEGRAM_WEBHOOK_SECRET` заполнять не нужно: первый берётся из `RENDER_EXTERNAL_URL`, второй генерируется при старте и сразу уходит в `setWebhook`. `NODE_ENV=production`, `TZ=Europe/Moscow` и `NODE_VERSION` уже прописаны в `render.yaml`.

5. Нажмите **Apply** / **Create**. Первый билд: `npm ci && npm run build`, старт: `npm start` (миграции → сервер).
6. Дождитесь статуса **Live** и откройте публичный URL.

### Вариант без Blueprint (вручную)

1. **New → Web Service** → выберите репозиторий.
2. **Runtime:** Node, **Build Command:** `npm ci && npm run build`, **Start Command:** `npm start`.
3. **Instance Type:** Free.
4. **Health Check Path:** `/healthz`.
5. В **Environment** добавьте переменные из таблицы выше + `NODE_ENV=production`, `TZ=Europe/Moscow`.
6. **Create Web Service**.

Если сервис уже создан, а `WEBHOOK_URL` вы поменяли — достаточно **Manual Deploy → Deploy latest commit** (или рестарта), webhook переустановится при старте.

---

## Шаг 5. Переменные окружения

Все значения — в Render Dashboard → сервис → **Environment**. В репозитории только `.env.example` без значений.

| Переменная | Обязательна | Назначение |
| --- | --- | --- |
| `DATABASE_URL` | да | Service URI Aiven или строка Neon PostgreSQL |
| `SESSION_SECRET` | да | подпись cookie сессии, минимум 16 символов |
| `ADMIN_USERNAME` | да | логин администратора |
| `ADMIN_PASSWORD_HASH` | да | bcrypt-хеш пароля (`npm run hash -- "пароль"`) |
| `TELEGRAM_BOT_TOKEN` | для бота | токен из @BotFather |
| `TELEGRAM_CHAT_ID` | для бота | куда присылать результаты |
| `WEBHOOK_URL` | нет | свой домен; на Render по умолчанию `RENDER_EXTERNAL_URL` |
| `TELEGRAM_WEBHOOK_SECRET` | нет | секрет webhook; если пусто, генерируется при старте |
| `NODE_ENV` | да | `production` на Render |
| `PORT` | нет | Render задаёт сам; локально по умолчанию 3000 |
| `TZ` | нет | часовой пояс дат, по умолчанию `Europe/Moscow` |
| `ADMIN_PASSWORD` | нет | пароль в открытом виде вместо хеша — только для локальной отладки |

При старте приложение печатает в лог, что настроено, а что нет, и падает с понятным сообщением, если нет `DATABASE_URL` или `SESSION_SECRET`.

---

## Шаг 6. Миграции и первый админ

**Миграции.** Уже готовы в `prisma/migrations/`. `npm start` вызывает `scripts/start.js`: он проверяет `DATABASE_URL` и `SESSION_SECRET`, применяет `prisma migrate deploy` и только потом запускает сервер. При ошибке в логе будет понятное сообщение, а не голый `P1012`. `npm run dev` тоже применяет миграции. Вручную:

```bash
npm run db:deploy     # или npx prisma migrate deploy
npm run db:status
```

**Первый админ.** Отдельной таблицы админов нет — это сделано специально, чтобы не хранить пароль в базе и не писать скрипт инициализации. Админ задаётся переменными:

1. Сгенерируйте хеш локально: `npm run hash -- "мой-пароль"`.
2. Вставьте логин в `ADMIN_USERNAME`, хеш — в `ADMIN_PASSWORD_HASH` (Render → Environment).
3. Перезапустите сервис (Render сделает это сам после сохранения переменных).
4. Войдите: `https://<сервис>.onrender.com/admin/login`.

Сменить пароль — сгенерировать новый хеш и заменить `ADMIN_PASSWORD_HASH`. Сессии при этом останутся, но старый пароль перестанет работать.

---

## Как пользоваться

1. Войдите в админку → **Создать тест**.
2. Введите название и описание.
3. Добавьте вопросы: текст, варианты ответов, галочка слева от варианта — правильный ответ. Для вопроса можно включить «несколько правильных» (множественный выбор).
4. **Сохранить** — черновик, **Сохранить и опубликовать** — тест появится на главной.
5. Отправьте ссылку на сайт — человек вводит имя, отвечает, нажимает «Завершить тест».
6. Результат: сообщение в Telegram + запись в **Результаты** с детализацией по каждому вопросу.
7. **Экспорт в CSV** — файл для Excel/Google Sheets (разделитель `;`, BOM для кириллицы).

### Полезные маршруты

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/` | опубликованные тесты |
| GET | `/tests/:id` | прохождение теста |
| POST | `/tests/:id/submit` | сохранить результат и отправить в Telegram |
| GET | `/thanks` | страница «Спасибо» |
| GET/POST | `/admin/login` | вход |
| POST | `/admin/logout` | выход |
| GET | `/admin/tests` | список тестов |
| GET | `/admin/tests/new` | создание |
| GET/POST | `/admin/tests/:id/edit`, `/admin/tests/:id` | редактирование |
| POST | `/admin/tests/:id/publish` | публикация / снятие |
| POST | `/admin/tests/:id/delete` | удаление |
| GET | `/admin/results` | результаты, фильтр по тесту, пагинация |
| GET | `/admin/results/:id` | детализация |
| GET | `/admin/results/export.csv` | CSV (`?testId=` — только один тест) |
| POST | `/api/telegram/webhook` | webhook бота (секрет обязателен) |
| GET | `/healthz` | health check Render |

---

## Ограничения Render Free (учтено)

- Сервис засыпает после 15 минут без трафика, первый запрос — до минуты. Это нормально, ничего в коде не «будим».
- Нет постоянного диска: SQLite и загрузка файлов не используются, всё во внешней PostgreSQL (Aiven/Neon).
- 512 MB RAM / 0.1 CPU: один процесс, без тяжёлых зависимостей.
- Порт берётся из `PORT`, сервер слушает `0.0.0.0`.
- Сессии хранятся в PostgreSQL (таблица `session`), поэтому вход в админку не сбрасывается после рестарта или сна.

---

## Что автоматизировано

- `npm start` → `scripts/start.js`: проверка `DATABASE_URL` и `SESSION_SECRET`, затем `prisma migrate deploy`, затем сервер. При отсутствии переменной — понятное сообщение вместо `P1012`.
- `render.yaml`: Render сам создаёт Web Service, выставляет `NODE_ENV`, `TZ`, `NODE_VERSION` и генерирует `SESSION_SECRET`.
- `WEBHOOK_URL` подставляется из `RENDER_EXTERNAL_URL`; `TELEGRAM_WEBHOOK_SECRET` генерируется при старте.
- Telegram webhook переустанавливается при каждом запуске сервиса.
- Таблица сессий входит в миграцию — отдельный SQL не нужен.

Ручными остаются только секреты ваших аккаунтов: `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — их нельзя хранить в репозитории.

---

## Если что-то не работает

| Симптом | Что проверить |
| --- | --- |
| `DATABASE_URL не задан` / падение при старте | переменная добавлена в Render → Environment, значения сохранены, сервис перезапущен |
| `P1012: Environment variable not found: DATABASE_URL` | сборка проходит, но старт падает: в Render нет `DATABASE_URL`. Dashboard → сервис → **Environment** → **Add Environment Variable** → Key `DATABASE_URL`, Value — Service URI Aiven или строка Neon → **Save** (сервис перезапустится). Если старт остался старым: **Manual Deploy → Deploy latest commit** |
| `P1001: Can't reach database server` | строка скопирована целиком, `sslmode=require` есть, сервис Aiven включён (Running); у Neon проект не на паузе |
| Aiven: сервис в статусе **Powered off** | free-план Aiven выключается после простоя: Console → сервис → **Power on**, подождите 1–2 минуты |
| `SESSION_SECRET не задан` | Render → Environment → **Add Environment Variable** → `SESSION_SECRET` = 64-символьная случайная строка (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) → **Save**. Если сервис создан не через Blueprint, `generateValue` из `render.yaml` не применяется. После добавления не меняйте значение — иначе сессии админки сбросятся |
| `unable to verify the first certificate` / `self-signed certificate` | в `DATABASE_URL` нет `?sslmode=require`; добавьте параметр. Для managed-баз пул сессий сам отключает проверку цепочки в режиме `require` |
| `The table ... does not exist` | не прошли миграции: `npm run db:deploy` локально или **Manual Deploy** на Render, смотрите лог билда |
| Логин не принимается | хеш сгенерирован тем же bcrypt и вставлен целиком (`$2b$12$...`), логин совпадает с `ADMIN_USERNAME`; при `NODE_ENV=production` cookie `secure`, вход только по https |
| «Неверный логин или пароль» | 1) В Render `ADMIN_USERNAME` = ровно тот логин, что вы вводите (регистр важен, без кавычек). 2) Перегенерируйте хеш: `npm run hash -- "пароль"` и вставьте в `ADMIN_PASSWORD_HASH` только строку, начинающуюся с `$2b$12$`. 3) **Save** и дождитесь рестарта. 4) В логах Render строка `[admin] неудачный вход: логин совпал/не совпал, пароль совпал/не совпал` покажет причину. Если заданы и хеш, и `ADMIN_PASSWORD`, используется хеш |
| После входа снова форма логина | изменён `SESSION_SECRET` или cookie блокируется; проверьте, что открываете https-адрес Render |
| Telegram молчит | бот добавлен в чат/канал, `TELEGRAM_CHAT_ID` верный (у канала минус в начале), бот админ канала, в логах нет `401 Unauthorized` |
| `getWebhookInfo` показывает ошибку | `WEBHOOK_URL` без слэша на конце и совпадает с адресом Render; `TELEGRAM_WEBHOOK_SECRET` не менялся после установки webhook; перезапустите сервис |
| Webhook отвечает 403 | секрет в Telegram и в env разошлись — переустановите webhook рестартом сервиса |
| CSV «в одну колонку» | файл открыт не Excel: используйте «Данные → Из текста», разделитель `;` |
| Холодный старт | первый запрос после сна до 60 секунд — это лимит Render Free |

Логи: Render Dashboard → сервис → **Logs**. При старте видно окружение, состояние бота и установку webhook.

---

## Безопасность

- Пароль админа — только bcrypt-хеш в env, в базе паролей нет.
- Сессии: httpOnly, `sameSite=lax`, `secure` на https, хранение в PostgreSQL, 12 часов.
- CSRF-токены на всех формах админки, проверка Origin для публичной отправки.
- Rate limit: вход (20 попыток / 15 мин), отправка теста (40 / 10 мин на IP).
- Helmet + строгий CSP (только свои скрипты и стили).
- Telegram webhook защищён `secret_token`, эндпоинт без настроенного секрета отвечает 503.
- В репозитории нет ключей и `.env`; `.env.example` содержит только имена переменных.
- HTML экранируется EJS, сообщения в Telegram — через HTML-escape.

---

## Ограничения реализации

- Один администратор, задаётся в env (по требованию).
- При сохранении теста вопросы пересоздаются. Старые прохождения не ломаются: в `SubmissionAnswer` хранятся текстовые снимки вопроса и выбранного ответа (`ON DELETE SET NULL`).
- Удаление теста удаляет и его результаты — в админке есть подтверждение.
- Файлы и картинки не загружаются: на Render Free нет диска.
- Бот работает только через webhook; long polling не используется.

---

## Чек-лист готовности

- [x] Все файлы проекта в репозитории, без заглушек и TODO.
- [x] `npm ci && npm run dev` поднимает сайт и админку.
- [x] `render.yaml` описывает Web Service с билдом, стартом и health check.
- [x] Prisma-схема и миграции готовы, применяются автоматически.
- [x] Публичная часть: список тестов, имя, вопросы (одиночный и множественный выбор), «Спасибо».
- [x] Админка: вход, создание/редактирование/публикация/удаление, результаты, детализация, CSV.
- [x] Telegram: webhook с секретом, автоустановка при старте, сообщение с результатом.
- [x] Переменные окружения описаны в `.env.example` и README.
- [x] Секретов в репозитории нет.
