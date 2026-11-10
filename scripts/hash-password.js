#!/usr/bin/env node
'use strict';

const bcrypt = require('bcryptjs');

const password = process.argv.slice(2).join(' ').trim();

async function main() {
  if (!password) {
    console.error('Использование: npm run hash -- "ваш-пароль"');
    console.error('Или:          node scripts/hash-password.js "ваш-пароль"');
    process.exit(1);
  }

  if (password.length < 8) {
    console.warn('Внимание: пароль короче 8 символов. Лучше взять длиннее.');
  }

  const hash = await bcrypt.hash(password, 12);

  console.log('');
  console.log('Готово. Вставьте строку целиком в переменную ADMIN_PASSWORD_HASH:');
  console.log('');
  console.log(hash);
  console.log('');
}

main().catch((error) => {
  console.error('Не удалось создать хеш:', error);
  process.exit(1);
});
