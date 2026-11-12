(function () {
  'use strict';

  var userMenu = document.querySelector('[data-user-menu]');
  if (userMenu) {
    var userMenuToggle = userMenu.querySelector('.user-chip');
    var userMenuPanel = userMenu.querySelector('.user-menu-panel');

    if (userMenuToggle && userMenuPanel) {
      var setUserMenuOpen = function (open) {
        userMenuPanel.hidden = !open;
        userMenuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      };

      userMenuToggle.addEventListener('click', function (event) {
        event.stopPropagation();
        setUserMenuOpen(userMenuPanel.hidden);
      });

      document.addEventListener('click', function (event) {
        if (!userMenu.contains(event.target)) setUserMenuOpen(false);
      });

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !userMenuPanel.hidden) {
          setUserMenuOpen(false);
          userMenuToggle.focus();
        }
      });

      userMenuPanel.addEventListener('click', function (event) {
        if (event.target.closest('a')) setUserMenuOpen(false);
      });
    }
  }

  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      var message = form.getAttribute('data-confirm');
      if (message && !window.confirm(message)) {
        event.preventDefault();
      }
    });
  });
})();
