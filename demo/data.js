'use strict';

const now = Date.now();
const hoursAgo = (hours) => new Date(now - hours * 60 * 60 * 1000);
const daysAgo = (days) => hoursAgo(days * 24);

function option(id, text, isCorrect) {
  return { id, text, isCorrect };
}

function question(id, text, options, correctIndex, extra = {}) {
  return {
    id,
    text,
    imageData: extra.image || null,
    multiple: Boolean(extra.multiple),
    options: options.map((text, index) => option(id * 10 + index, text, index === correctIndex)),
  };
}

const mapImage =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="520" viewBox="0 0 1200 520">
  <defs>
    <radialGradient id="glow" cx="78%" cy="16%" r="70%">
      <stop offset="0" stop-color="#ff3b30" stop-opacity=".32"/>
      <stop offset="1" stop-color="#ff3b30" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity=".055"/>
    </pattern>
  </defs>
  <rect width="1200" height="520" fill="#121215"/>
  <rect width="1200" height="520" fill="url(#glow)"/>
  <rect width="1200" height="520" fill="url(#grid)"/>
  <path d="M70 390h250v-80h180v-190h300v120h230v170h100" fill="none" stroke="#5d3034" stroke-width="18" stroke-linejoin="round"/>
  <path d="M70 390h250v-80h180v-190h300v120h230v170h100" fill="none" stroke="#ff5a4f" stroke-opacity=".35" stroke-width="2" stroke-linejoin="round"/>
  <rect x="390" y="120" width="300" height="190" fill="#ff3b30" fill-opacity=".055" stroke="#ff5a4f" stroke-opacity=".3"/>
  <rect x="430" y="170" width="90" height="90" fill="#ff3b30" fill-opacity=".2" stroke="#ff5a4f" stroke-opacity=".55"/>
  <text x="475" y="226" fill="#ffb0ab" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700" text-anchor="middle">A</text>
  <rect x="640" y="205" width="78" height="66" fill="#ff3b30" fill-opacity=".14" stroke="#ff5a4f" stroke-opacity=".4"/>
  <text x="679" y="247" fill="#ffb0ab" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" text-anchor="middle">B</text>
  <text x="70" y="100" fill="#f4f4f6" font-family="Segoe UI, Arial, sans-serif" font-size="62" font-weight="900" letter-spacing="2">DUST II</text>
  <text x="72" y="135" fill="#8d8d99" font-family="Segoe UI, Arial, sans-serif" font-size="18" letter-spacing="5">TACTICAL MAP / DEMO</text>
  <text x="72" y="468" fill="#64646e" font-family="Segoe UI, Arial, sans-serif" font-size="16" letter-spacing="2">ADMIN MENU · QUESTION IMAGE</text>
</svg>`);

const TESTS = [
  {
    id: 1,
    title: 'Основы CS2',
    description: 'Карты, экономика и механики соревновательного режима CS2.',
    isPublished: true,
    createdAt: daysAgo(18),
    _count: { submissions: 8 },
    questions: [
      question(
        11,
        'Какая карта изображена на схеме?',
        ['Mirage', 'Dust II', 'Inferno'],
        1,
        { image: mapImage },
      ),
      question(
        12,
        'Сколько раундов нужно выиграть, чтобы победить в MR12?',
        ['11', '13', '16'],
        1,
      ),
      question(
        13,
        'Какой гранатой ставят дымовую завесу?',
        ['Flashbang', 'Smoke', 'Molotov'],
        1,
      ),
      question(
        14,
        'Что такое эко-раунд?',
        ['Раунд без закупки или с минимальной закупкой', 'Раунд только с AWP', 'Раунд на пистолетах'],
        0,
      ),
      question(
        15,
        'Сколько игроков в каждой команде?',
        ['4', '5', '6'],
        1,
      ),
    ],
  },
  {
    id: 2,
    title: 'Тактика 5×5',
    description: 'Роли, коммуникация и принятие решений в атаке и защите.',
    isPublished: true,
    createdAt: daysAgo(12),
    _count: { submissions: 4 },
    questions: [
      question(
        21,
        'Кто такой IGL?',
        ['Снайпер команды', 'Капитан, который ведёт игру', 'Тренер состава'],
        1,
      ),
      question(
        22,
        'Какова задача entry fragger?',
        ['Открывать раунд и заходить первым', 'Держать спину команды', 'Играть только на время'],
        0,
      ),
      question(
        23,
        'Что такое trade kill?',
        ['Убийство соперника сразу после смерти союзника', 'Убийство через дым', 'Победа на пистолетном раунде'],
        0,
      ),
      question(
        24,
        'Где обычно играет lurker?',
        ['На точке вместе с командой', 'Вне основного контакта, ищет свободное пространство', 'Только на пистолете'],
        1,
      ),
    ],
  },
  {
    id: 3,
    title: 'Экономика раунда',
    description: 'Закупка, loss bonus и решения, которые решают раунд.',
    isPublished: true,
    createdAt: daysAgo(9),
    _count: { submissions: 3 },
    questions: [
      question(
        31,
        'Сколько денег дают за убийство из AK-47?',
        ['$100', '$300', '$600'],
        1,
      ),
      question(
        32,
        'Какой максимальный loss bonus?',
        ['$1400', '$2400', '$3400'],
        2,
      ),
      question(
        33,
        'Когда команде выгодно сделать save?',
        ['Когда раунд почти проигран и нужно сохранить оружие', 'В начале каждого раунда', 'После первого убийства'],
        0,
      ),
      question(
        34,
        'Сколько стоит дефьюз-кит?',
        ['$400', '$500', '$650'],
        0,
      ),
    ],
  },
  {
    id: 4,
    title: 'Легенды сцены',
    description: 'Игроки и команды, которые сформировали современную сцену.',
    isPublished: true,
    createdAt: daysAgo(5),
    _count: { submissions: 1 },
    questions: [
      question(
        41,
        'Кто из игроков известен под ником s1mple?',
        ['Александр Костылев', 'Илья Осипов', 'Даниил Крышковец'],
        0,
      ),
      question(
        42,
        'За какую команду долго выступал device?',
        ['Astralis', 'Natus Vincere', 'FaZe Clan'],
        0,
      ),
      question(
        43,
        'Какой ник у Даниила Крышковца?',
        ['donk', 'm0NESY', 'B1T'],
        0,
      ),
      question(
        44,
        'Кто такой NiKo?',
        ['Боснийский игрок, один из сильнейших рифлеров', 'Шведский снайпер', 'Тренер Natus Vincere'],
        0,
      ),
    ],
  },
];

for (const test of TESTS) {
  test._count.questions = test.questions.length;
}

const SUBMISSIONS = [
  { id: 1080, testId: 1, participantName: 's1mple', score: 5, totalQuestions: 5, createdAt: hoursAgo(2), test: { title: 'Основы CS2' } },
  { id: 1079, testId: 2, participantName: 'NiKo', score: 4, totalQuestions: 4, createdAt: hoursAgo(5), test: { title: 'Тактика 5×5' } },
  { id: 1078, testId: 1, participantName: 'donk', score: 5, totalQuestions: 5, createdAt: hoursAgo(25), test: { title: 'Основы CS2' } },
  { id: 1077, testId: 3, participantName: 'm0NESY', score: 3, totalQuestions: 4, createdAt: hoursAgo(28), test: { title: 'Экономика раунда' } },
  { id: 1076, testId: 1, participantName: 's1mple', score: 4, totalQuestions: 5, createdAt: hoursAgo(49), test: { title: 'Основы CS2' } },
  { id: 1075, testId: 1, participantName: 'B1T', score: 3, totalQuestions: 5, createdAt: hoursAgo(53), test: { title: 'Основы CS2' } },
  { id: 1074, testId: 4, participantName: 'NiKo', score: 3, totalQuestions: 4, createdAt: hoursAgo(73), test: { title: 'Легенды сцены' } },
  { id: 1073, testId: 2, participantName: 's1mple', score: 4, totalQuestions: 4, createdAt: hoursAgo(97), test: { title: 'Тактика 5×5' } },
  { id: 1072, testId: 2, participantName: 'donk', score: 4, totalQuestions: 4, createdAt: hoursAgo(121), test: { title: 'Тактика 5×5' } },
  { id: 1071, testId: 3, participantName: 'm0NESY', score: 4, totalQuestions: 4, createdAt: hoursAgo(145), test: { title: 'Экономика раунда' } },
  { id: 1070, testId: 1, participantName: 'NiKo', score: 5, totalQuestions: 5, createdAt: hoursAgo(169), test: { title: 'Основы CS2' } },
  { id: 1069, testId: 3, participantName: 's1mple', score: 5, totalQuestions: 5, createdAt: hoursAgo(193), test: { title: 'Экономика раунда' } },
  { id: 1068, testId: 1, participantName: 'donk', score: 4, totalQuestions: 5, createdAt: hoursAgo(217), test: { title: 'Основы CS2' } },
  { id: 1067, testId: 1, participantName: 'B1T', score: 2, totalQuestions: 5, createdAt: hoursAgo(241), test: { title: 'Основы CS2' } },
  { id: 1066, testId: 1, participantName: 's1mple', score: 3, totalQuestions: 5, createdAt: hoursAgo(265), test: { title: 'Основы CS2' } },
  { id: 1065, testId: 2, participantName: 'NiKo', score: 3, totalQuestions: 4, createdAt: hoursAgo(289), test: { title: 'Тактика 5×5' } },
];

module.exports = { TESTS, SUBMISSIONS, mapImage };
