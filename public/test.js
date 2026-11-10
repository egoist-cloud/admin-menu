(function () {
  'use strict';

  var form = document.getElementById('test-form');
  if (!form) return;

  var nameInput = form.querySelector('input[name="participantName"]');

  form.addEventListener('submit', function (event) {
    if (nameInput && !nameInput.value.trim()) {
      event.preventDefault();
      nameInput.focus();
      nameInput.reportValidity();
      return;
    }

    var blocks = form.querySelectorAll('[data-multiple="1"]');
    for (var i = 0; i < blocks.length; i += 1) {
      var checked = blocks[i].querySelectorAll('input[type="checkbox"]:checked');
      if (checked.length === 0) {
        event.preventDefault();
        window.alert('В вопросах с несколькими ответами нужно выбрать хотя бы один вариант.');
        blocks[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
  });
})();
