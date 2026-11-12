(function () {
  'use strict';

  var modal = document.getElementById('player-modal');
  if (!modal) return;

  var title = document.getElementById('player-modal-title');
  var subtitle = document.getElementById('player-modal-subtitle');
  var avatar = document.getElementById('player-modal-avatar');
  var stats = document.getElementById('player-modal-stats');
  var list = document.getElementById('player-modal-list');
  var opener = null;
  var requestId = 0;

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
  }

  function percentOf(submission) {
    if (!submission.totalQuestions) return 0;
    return Math.round((submission.score / submission.totalQuestions) * 100);
  }

  function badgeClass(percent) {
    if (percent >= 80) return 'badge badge-ok';
    if (percent >= 50) return 'badge badge-draft';
    return 'badge badge-bad';
  }

  function badgeText(percent) {
    if (percent >= 80) return 'Отлично';
    if (percent >= 50) return 'Пройден';
    return 'Слабо';
  }

  function addStat(label, value) {
    var item = node('div', 'player-stat');
    item.appendChild(node('span', 'player-stat-label', label));
    item.appendChild(node('strong', 'player-stat-value', value));
    stats.appendChild(item);
  }

  function render(data) {
    title.textContent = data.name;
    subtitle.textContent = 'Игрок · всего прохождений: ' + data.total;
    avatar.textContent = (data.name.trim().charAt(0) || '?').toUpperCase();

    stats.innerHTML = '';
    addStat('Прохождений', data.total);
    addStat('Средний результат', data.average + '%');
    addStat('Лучший результат', data.best + '%');
    addStat('Последнее', data.lastAt);

    list.innerHTML = '';

    if (!data.submissions.length) {
      list.appendChild(node('div', 'player-empty', 'У этого игрока пока нет прохождений.'));
      return;
    }

    data.submissions.forEach(function (submission) {
      var row = document.createElement('a');
      row.className = 'player-history-row';
      row.href = '/admin/results/' + submission.id;

      row.appendChild(node('span', 'player-history-id', '#' + submission.id));

      var main = node('span', 'player-history-main');
      main.appendChild(node('strong', 'player-history-title', submission.testTitle));
      main.appendChild(node('span', 'player-history-date', submission.date));
      row.appendChild(main);

      row.appendChild(
        node('span', 'player-history-score', submission.score + ' / ' + submission.totalQuestions),
      );
      row.appendChild(node('span', badgeClass(submission.percent), badgeText(submission.percent)));

      list.appendChild(row);
    });
  }

  function open(button) {
    var url = button.getAttribute('data-history-url');
    if (!url) return;

    opener = button;
    var currentRequest = ++requestId;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    title.textContent = 'История игрока';
    subtitle.textContent = 'Загрузка…';
    avatar.textContent = '…';
    stats.innerHTML = '';
    list.innerHTML = '';
    list.appendChild(node('div', 'player-empty', 'Загружаю прохождения…'));

    fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Не удалось загрузить историю игрока.');
        return response.json();
      })
      .then(function (data) {
        if (currentRequest === requestId) render(data);
      })
      .catch(function (error) {
        if (currentRequest !== requestId) return;
        subtitle.textContent = 'История недоступна';
        list.innerHTML = '';
        list.appendChild(node('div', 'player-empty', error.message));
      });
  }

  function close() {
    requestId += 1;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    if (opener && typeof opener.focus === 'function') opener.focus();
  }

  document.addEventListener('click', function (event) {
    var historyButton = event.target.closest('[data-history-url]');
    if (historyButton) {
      event.preventDefault();
      open(historyButton);
      return;
    }

    if (event.target.closest('[data-close-player]')) close();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !modal.hidden) close();
  });
})();
