'use strict';

require('dotenv').config();

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');

function fail(title, lines) {
  console.error('');
  console.error(`[запуск] ${title}`);
  for (const line of lines) console.error(`  ${line}`);
  console.error('');
  process.exit(1);
}

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const sessionSecret = String(process.env.SESSION_SECRET || '').trim();

if (!databaseUrl) {
  fail('DATABASE_URL не задан — без него Prisma не может подключиться к базе (ошибка P1012).', [
    'Render: Dashboard → ваш сервис → Environment → Add Environment Variable',
    '  Key:   DATABASE_URL',
    '  Value: postgresql://user:password@host/dbname?sslmode=require (Service URI из Aiven или строка Neon)',
    'Затем Save — Render перезапустит сервис автоматически.',
    '',
    'Локально: скопируйте .env.example в .env и заполните DATABASE_URL.',
  ]);
}

if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
  fail('DATABASE_URL имеет неверный формат.', [
    'Нужна строка подключения PostgreSQL, например:',
    '  postgresql://avnadmin:ПАРОЛЬ@pg-xxx.aivencloud.com:12345/defaultdb?sslmode=require',
    'Не вставляйте сюда пароль, токен или URL сайта.',
  ]);
}

const isLocalDatabase = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(databaseUrl);
if (!isLocalDatabase && !/[?&]sslmode=/i.test(databaseUrl)) {
  console.warn('[запуск] в DATABASE_URL нет sslmode=require — для Aiven, Neon и Supabase TLS обычно обязателен.');
  console.warn('          Добавьте ?sslmode=require в конец строки подключения.');
}

if (!sessionSecret) {
  fail('SESSION_SECRET не задан — без него не работают сессии админки.', [
    'Сгенерируйте строку: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    'Render: Environment → SESSION_SECRET (или оставьте generateValue из render.yaml).',
  ]);
}

console.log('[запуск] применяю миграции Prisma...');

const prismaCli = require.resolve('prisma/build/index.js');
const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  fail('не удалось запустить Prisma CLI.', [result.error.message]);
}

if (result.status !== 0) {
  fail('миграции не применились — сервер не запущен.', [
    'Проверьте DATABASE_URL (хост, пароль, ?sslmode=require) и доступность базы.',
    'P1001 — база недоступна: неверный хост/пароль, сервис Aiven выключен (Powered off) или проект Neon на паузе.',
    'P1012 — DATABASE_URL не задан или пустой.',
    'P3005 — в базе уже есть таблицы без истории миграций: возьмите пустую базу Aiven/Neon.',
    'Логи Prisma выше показывают точную причину.',
  ]);
}

console.log('[запуск] миграции применены. Стартую сервер...');

require(path.join(projectRoot, 'src', 'server.js'));
