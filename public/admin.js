(function () {
  'use strict';

  var form = document.getElementById('test-form');
  if (!form) return;

  var list = document.getElementById('questions');
  var template = document.getElementById('question-template');
  var initialField = document.getElementById('initial-questions');
  var hiddenField = document.getElementById('questions-json');
  var emptyHint = document.getElementById('questions-empty');

  function updateNumbers() {
    var nodes = list.querySelectorAll('.question-editor');
    for (var i = 0; i < nodes.length; i += 1) {
      nodes[i].querySelector('.q-index').textContent = String(i + 1);
    }
    if (emptyHint) emptyHint.hidden = nodes.length > 0;
  }

  function createOptionRow(option) {
    var row = document.createElement('div');
    row.className = 'option-editor';

    var correctLabel = document.createElement('label');
    correctLabel.className = 'checkbox correct-toggle';
    correctLabel.title = 'Правильный ответ';

    var correct = document.createElement('input');
    correct.type = 'checkbox';
    correct.className = 'opt-correct';
    correct.checked = Boolean(option && option.isCorrect);
    correctLabel.appendChild(correct);

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'input opt-text';
    input.maxLength = 500;
    input.placeholder = 'Вариант ответа';
    input.value = option && option.text ? option.text : '';

    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-ghost btn-sm opt-remove';
    remove.title = 'Удалить вариант';
    remove.textContent = '×';

    row.appendChild(correctLabel);
    row.appendChild(input);
    row.appendChild(remove);

    return row;
  }

  function bindQuestion(node) {
    var multiple = node.querySelector('.q-multiple');
    var options = node.querySelector('.options');

    node.querySelector('.opt-add').addEventListener('click', function () {
      options.appendChild(createOptionRow({}));
    });

    options.addEventListener('click', function (event) {
      var button = event.target.closest('.opt-remove');
      if (!button) return;
      if (options.querySelectorAll('.option-editor').length <= 2) {
        window.alert('У вопроса должно быть минимум два варианта ответа.');
        return;
      }
      button.closest('.option-editor').remove();
    });

    options.addEventListener('change', function (event) {
      if (!event.target.classList.contains('opt-correct')) return;
      if (multiple.checked || !event.target.checked) return;
      var all = options.querySelectorAll('.opt-correct');
      for (var i = 0; i < all.length; i += 1) {
        if (all[i] !== event.target) all[i].checked = false;
      }
    });

    multiple.addEventListener('change', function () {
      if (multiple.checked) return;
      var checked = options.querySelectorAll('.opt-correct:checked');
      for (var i = 1; i < checked.length; i += 1) checked[i].checked = false;
    });

    node.querySelector('.q-remove').addEventListener('click', function () {
      node.remove();
      updateNumbers();
    });
  }

  function addQuestion(question) {
    var node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('.q-text').value = question && question.text ? question.text : '';
    node.querySelector('.q-multiple').checked = Boolean(question && question.multiple);

    var options = node.querySelector('.options');
    var optionList =
      question && Array.isArray(question.options) && question.options.length > 0
        ? question.options
        : [{}, {}];

    optionList.forEach(function (option) {
      options.appendChild(createOptionRow(option));
    });

    bindQuestion(node);
    list.appendChild(node);
    updateNumbers();

    return node;
  }

  function collect() {
    var questions = [];
    var nodes = list.querySelectorAll('.question-editor');

    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var options = [];
      var rows = node.querySelectorAll('.option-editor');

      for (var j = 0; j < rows.length; j += 1) {
        var text = rows[j].querySelector('.opt-text').value.trim();
        if (!text) continue;
        options.push({
          text: text,
          isCorrect: rows[j].querySelector('.opt-correct').checked,
        });
      }

      questions.push({
        text: node.querySelector('.q-text').value.trim(),
        multiple: node.querySelector('.q-multiple').checked,
        options: options,
      });
    }

    return questions;
  }

  function validate(questions) {
    if (questions.length === 0) return 'Добавьте хотя бы один вопрос.';

    for (var i = 0; i < questions.length; i += 1) {
      var question = questions[i];
      var number = i + 1;

      if (!question.text) return 'Вопрос ' + number + ': заполните текст вопроса.';
      if (question.options.length < 2) {
        return 'Вопрос ' + number + ': нужно минимум два варианта ответа.';
      }

      var correct = question.options.filter(function (option) {
        return option.isCorrect;
      }).length;

      if (correct === 0) return 'Вопрос ' + number + ': отметьте правильный ответ.';
      if (!question.multiple && correct > 1) {
        return 'Вопрос ' + number + ': для одиночного выбора можно отметить только один правильный ответ.';
      }
    }

    return null;
  }

  form.addEventListener('submit', function (event) {
    var questions = collect();
    var error = validate(questions);

    if (error) {
      event.preventDefault();
      window.alert(error);
      return;
    }

    hiddenField.value = JSON.stringify(questions);
  });

  document.getElementById('add-question').addEventListener('click', function () {
    var node = addQuestion({});
    node.querySelector('.q-text').focus();
  });

  var initialQuestions = [];
  try {
    initialQuestions = JSON.parse(initialField.value || '[]');
  } catch (error) {
    initialQuestions = [];
  }

  if (Array.isArray(initialQuestions) && initialQuestions.length > 0) {
    initialQuestions.forEach(function (question) {
      addQuestion(question);
    });
  } else {
    addQuestion({});
  }

  updateNumbers();
})();
