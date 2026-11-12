# Admin Menu

Онлайн-тесты с тёмной админ-панелью в стиле CS2RED, картинками к вопросам, историей игрока и уведомлениями в Telegram. Один Node.js-сервис: публичный сайт, админка и бот (webhook) — без отдельных фронтенд- и бот-сервисов.

## Возможности

- **Публичный сайт:** список опубликованных тестов, ввод имени, прохождение, страница «Спасибо».
- **Админка:** вход по логину и паролю, создание и редактирование тестов, публикация, удаление.
- **Картинки:** к вопросу можно прикрепить PNG, JPG, WebP или GIF (GIF сохраняется как статичный JPEG). Изображение сжимается в браузере до 1200 px в JPEG, хранится в PostgreSQL и показывается участнику при прохождении.
- **История игрока:** клик по имени в результатах открывает все прохождения этого игрока — средний и лучший результат, дату последней попытки, счёт и статус каждой попытки.
- **Поиск:** результаты фильтруются по тесту и имени игрока; фильтр учитывается в экспорте CSV.
- **Результаты:** детализация ответов, ручная отправка результата в Telegram.
- **Telegram:** результат приходит в чат сразу после прохождения.
- **База:** PostgreSQL (Aiven или Neon) через Prisma, миграции применяются автоматически при старте.

## Оформление

Интерфейс сделан в тёмной красно-графитовой теме:

- боковое меню и верхняя панель;
- баннер «Админ-панель» на страницах управления;
- карточки тестов с обложками;
- модальное окно истории игрока в стиле списка тикетов;
- адаптивная вёрстка для телефона.

Внешних шрифтов, картинок и CDN нет: все стили и иконки локальные.

## Стек

| Слой | Технология |
| --- | --- |
| Хостинг | Render Web Service (Free) |
| База | PostgreSQL: Aiven Free или Neon (`DATABASE_URL`) |
| Backend | Node.js 20+ / Express 5 |
| ORM | Prisma 6 + миграции в репозитории |
| Frontend | EJS (серверные шаблоны) + свой CSS/JS |
| Бот | grammY, режим webhook |
| Аутентификация | express-session + bcrypt, один админ из env |

**Почему EJS, а не React/Vite.** Один Web Service на Free-тарифе: серверные шаблоны отдают готовый HTML без второго контейнера, сборки фронтенда и проксирования API. Это меньше памяти (512 MB), меньше точек отказа и один шаг деплоя.

**Почему `bcryptjs`.** Тот же алгоритм bcrypt (хеши `$2b$` совместимы), но без нативной компиляции при установке на Render.

**Prisma зафиксирована на 6.19.3.** Версии зафиксированы явно, чтобы сборка не подтянула несовместимый мажор.

## Структура проекта

```
admin-menu/
├── prisma/
│   ├── schema.prisma
│   └── migrations/                  # схема, картинки вопросов, таблица сессий
├── public/
│   ├── styles.css                   # тёмная тема
│   ├── admin.js                     # редактор вопросов и загрузка картинок
│   ├── players.js                   # модальное окно истории игрока
│   ├── test.js
│   ├── ui.js
│   └── favicon.svg
├── scripts/
│   ├── hash-password.js
│   └── start.js                     # env → миграции → сервер
├── src/
│   ├── config.js
│   ├── prisma.js
│   ├── server.js
│   ├── lib/                         # подсчёт, валидация, Telegram
│   ├── middleware/                  # auth, csrf
│   └── routes/                      # public, admin, telegram
├── views/
│   ├── partials/                    # шапка, подвал, баннер, история игрока
│   ├── admin/
│   ├── index.ejs
│   ├── test.ejs
│   ├── thanks.ejs
│   └── error.ejs
├── .env.example
├── package.json
├── package-lock.json
└── render.yaml
```

## Быстрый старт

Нужен Node.js 20 или новее.

```bash
npm ci
cp .env.example .env
```

Заполните `.env`:

```env
DATABASE_URL="postgresql://avnadmin:ПАРОЛЬ@pg-xxx.aivencloud.com:12345/defaultdb?sslmode=require"
SESSION_SECRET="длинная-случайная-строка"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD_HASH="$2b$12$..."
TELEGRAM_BOT_TOKEN="123456:AA..."
TELEGRAM_CHAT_ID="123456789"
WEBHOOK_URL="http://localhost:3000"
TELEGRAM_WEBHOOK_SECRET="случайный-секрет"
NODE_ENV=development
TZ=Europe/Moscow
```

Секреты и хеш пароля:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
npm run hash -- "ваш-пароль"
```

Запуск:

```bash
npm run dev
```

- сайт — http://localhost:3000
- админка — http://localhost:3000/admin/login

`npm run dev` сначала применяет миграции, затем запускает сервер с авто-перезагрузкой.

### Скрипты

| Команда | Что делает |
| --- | --- |
| `npm run dev` | миграции + сервер с watch |
| `npm start` | проверка env → миграции → сервер (так запускает Render) |
| `npm run build` | `prisma generate` |
| `npm run db:deploy` | применить миграции вручную |
| `npm run db:status` | статус миграций |
| `npm run db:studio` | Prisma Studio |
| `npm run hash -- "пароль"` | bcrypt-хеш для `ADMIN_PASSWORD_HASH` |

## База данных

### Aiven Free

1. [aiven.io](https://aiven.io) → **Sign up** (карта не нужна).
2. **Create service** → **PostgreSQL** → план **Free** → регион ближе к Render → **Create service**.
3. Дождитесь статуса **Running**.
4. В **Overview** скопируйте **Service URI** — это `DATABASE_URL`.

Строка выглядит так:

```text
postgresql://avnadmin:ПАРОЛЬ@pg-xxxx.aivencloud.com:12345/defaultdb?sslmode=require
```

Параметр `?sslmode=require` обязателен. IP-фильтр настраивать не нужно. На free-плане Aiven может выключаться после простоя — включите **Power on** в консоли.

### Neon

1. [neon.tech](https://neon.tech) → **New Project** → **Connect**.
2. Возьмите **Direct connection** (хост без `-pooler`) и строку с `?sslmode=require`.

Схема создаётся автоматически при первом запуске (`prisma migrate deploy`).

## Telegram-бот

1. [@BotFather](https://t.me/BotFather) → `/newbot`.
2. Скопируйте токен в `TELEGRAM_BOT_TOKEN`.
3. Напишите боту `/start` — он ответит вашим `chat_id`. Это `TELEGRAM_CHAT_ID`.

Если результаты нужны в канале, добавьте бота администратором и укажите id канала вида `-1001234567890`.

`WEBHOOK_URL` на Render не нужен: приложение берёт `RENDER_EXTERNAL_URL` автоматически. Webhook ставится при старте на `<URL>/api/telegram/webhook` с секретным токеном.

## Деплой на Render

1. Запушьте проект в GitHub.
2. [render.com](https://render.com) → **New → Blueprint** → выберите репозиторий.
3. Render прочитает `render.yaml` и попросит заполнить переменные с `sync: false`.
4. Нажмите **Apply** и дождитесь статуса **Live**.

| Переменная | Значение |
| --- | --- |
| `DATABASE_URL` | Service URI Aiven или строка Neon |
| `ADMIN_USERNAME` | логин админа |
| `ADMIN_PASSWORD_HASH` | bcrypt-хеш из `npm run hash -- "пароль"` |
| `TELEGRAM_BOT_TOKEN` | токен из BotFather |
| `TELEGRAM_CHAT_ID` | ваш chat_id или id канала |

`SESSION_SECRET` Render сгенерирует сам при создании через Blueprint. Если сервис создавался вручную, добавьте его в **Environment**:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`NODE_ENV=production`, `TZ=Europe/Moscow` и `NODE_VERSION` уже прописаны в `render.yaml`.

### Если сервис создаётся вручную

- **Runtime:** Node
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npm start`
- **Instance Type:** Free
- **Health Check Path:** `/healthz`

### Переменные окружения

| Переменная | Обязательна | Назначение |
| --- | --- | --- |
| `DATABASE_URL` | да | PostgreSQL Service URI |
| `SESSION_SECRET` | да | подпись cookie сессии, минимум 16 символов |
| `ADMIN_USERNAME` | да | логин администратора |
| `ADMIN_PASSWORD_HASH` | да | bcrypt-хеш пароля |
| `TELEGRAM_BOT_TOKEN` | для бота | токен из BotFather |
| `TELEGRAM_CHAT_ID` | для бота | куда присылать результаты |
| `WEBHOOK_URL` | нет | свой домен; на Render берётся `RENDER_EXTERNAL_URL` |
| `TELEGRAM_WEBHOOK_SECRET` | нет | секрет webhook; если пусто, генерируется при старте |
| `NODE_ENV` | да | `production` на Render |
| `PORT` | нет | Render задаёт сам; локально 3000 |
| `TZ` | нет | часовой пояс, по умолчанию `Europe/Moscow` |
| `ADMIN_PASSWORD` | нет | пароль в открытом виде вместо хеша, только для локальной отладки |

## Как пользоваться

1. Войдите в админку → **Создать тест**.
2. Введите название и описание.
3. Добавьте вопросы: текст, варианты ответов, галочка слева от варианта — правильный ответ. Можно включить «несколько правильных».
4. При необходимости нажмите **«+ Картинка к вопросу»** — изображение сожмётся автоматически, появится превью, его можно убрать.
5. **Сохранить** — черновик, **Сохранить и опубликовать** — тест появится на главной.
6. Отправьте ссылку на сайт — человек вводит имя, отвечает и нажимает «Завершить тест».
7. Результат приходит в Telegram и появляется в **Результатах**. Нажмите на имя игрока, чтобы открыть историю всех его прохождений.
8. **Экспорт в CSV** — файл для Excel/Google Sheets (разделитель `;`, BOM для кириллицы). Поиск по имени учитывается в экспорте.

### Маршруты

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
| GET | `/admin/results` | результаты, фильтр по тесту и имени, пагинация |
| GET | `/admin/players/history` | история прохождений игрока (JSON для модального окна) |
| GET | `/admin/results/:id` | детализация |
| GET | `/admin/results/export.csv` | CSV (`?testId=` и `?name=`) |
| POST | `/api/telegram/webhook` | webhook бота |
| GET | `/healthz` | health check Render |

## Ограничения

- **История игрока группируется по имени.** Отдельных аккаунтов участников нет, поэтому одинаковые имена разных людей попадут в одну историю, а разные написания одного человека — в разные.
- Один администратор, задаётся в env.
- При сохранении теста вопросы пересоздаются. Старые прохождения не ломаются: в `SubmissionAnswer` хранятся текстовые снимки вопроса и ответа (`ON DELETE SET NULL`).
- Удаление теста удаляет и его результаты.
- Отдельного файлового хранилища нет: картинка сжимается в браузере (до 1200 px, JPEG) и хранится в PostgreSQL как data URL. Ограничение — около 1,2 МБ на изображение.
- Бот работает только через webhook; long polling не используется.
- Render Free засыпает после простоя; первый запрос может занять до минуты.

## Если что-то не работает

| Симптом | Что проверить |
| --- | --- |
| `DATABASE_URL не задан` | переменная добавлена в Render → Environment, значения сохранены, сервис перезапущен |
| `P1012` | в Render нет `DATABASE_URL`; добавьте и сделайте **Manual Deploy → Deploy latest commit** |
| `P1001: Can't reach database server` | строка скопирована целиком, есть `sslmode=require`, Aiven не на паузе |
| Aiven **Powered off** | Console → сервис → **Power on**, подождите 1–2 минуты |
| `SESSION_SECRET не задан` | добавьте 64-символьную случайную строку в Environment |
| `unable to verify the first certificate` | в `DATABASE_URL` нет `?sslmode=require` |
| `The table ... does not exist` | не прошли миграции: `npm run db:deploy` или Manual Deploy |
| Логин не принимается | `ADMIN_USERNAME` совпадает, хеш вставлен целиком (`$2b$12$...`), сервис перезапущен |
| После входа снова форма логина | не менялся `SESSION_SECRET`; открывайте https-адрес Render |
| Telegram молчит | `/admin/telegram` → статус и тестовая отправка; `401` — токен, `400 chat not found` — chat_id, `403` — бот заблокирован |
| Webhook отвечает 403 | секрет в Telegram и env разошлись — перезапустите сервис |
| `404 x-render-routing: no-server` | сервис на Render не запущен/удалён или открыт не тот URL; проверьте Dashboard |
| CSV в одну колонку | в Excel используйте «Данные → Из текста», разделитель `;` |

Логи: Render Dashboard → сервис → **Logs**. При старте видно окружение, состояние бота и установку webhook.

## Безопасность

- Пароль админа — только bcrypt-хеш в env, в базе паролей нет.
- Сессии: httpOnly, `sameSite=lax`, `secure` на https, хранение в PostgreSQL, 12 часов.
- CSRF-токены на всех формах админки, проверка Origin для публичной отправки.
- Rate limit: вход (20 попыток / 15 мин), отправка теста (40 / 10 мин на IP).
- Helmet + строгий CSP: свои скрипты и стили, изображения `self` и `data:`.
- Telegram webhook защищён `secret_token`.
- Картинки вопросов проверяются на сервере: допустимы только data URL с PNG/JPG/WebP/GIF и ограничением размера.
- В репозитории нет ключей и `.env`; `.env.example` содержит только имена переменных.
- HTML экранируется EJS, сообщения в Telegram — через HTML-escape.

## Проверки

- `npm run build` — Prisma Client генерируется.
- `npm run db:status` — состояние миграций.
- Публичная часть: список тестов, имя, вопросы, картинки, «Спасибо».
- Админка: вход, создание/редактирование/публикация/удаление, результаты, история игрока, CSV.
- Telegram: webhook с секретом, автоустановка при старте, сообщение с результатом.
