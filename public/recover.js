(function () {
  'use strict';

  var STORAGE_KEY = 'admin-menu-partial-reload';
  var checked = false;

  function isComplete() {
    return Boolean(document.getElementById('app-ready') && document.querySelector('main'));
  }

  function readAttempts() {
    try {
      return Number(sessionStorage.getItem(STORAGE_KEY) || '0');
    } catch {
      return 0;
    }
  }

  function writeAttempts(value) {
    try {
      if (value > 0) sessionStorage.setItem(STORAGE_KEY, String(value));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // sessionStorage может быть недоступен в приватном режиме.
    }
  }

  function check() {
    if (checked) return;
    checked = true;

    if (isComplete()) {
      writeAttempts(0);
      return;
    }

    var attempts = readAttempts();
    if (attempts >= 2) return;

    writeAttempts(attempts + 1);
    window.location.reload();
  }

  window.addEventListener('load', function () {
    window.setTimeout(check, 600);
  });

  // Если ответ оборвался до события load, таймер всё равно проверит документ.
  window.setTimeout(check, 5000);
})();
