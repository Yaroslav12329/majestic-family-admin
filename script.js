// ===== MOCK DATA =====

const players = [
  { rank: 1, name: "Phantom Veles", tag: "PV", ps: 1287, delta: 24, family: "Vorona" },
  { rank: 2, name: "Nikko Sharkov", tag: "NS", ps: 1244, delta: -8, family: "Black Reef" },
  { rank: 3, name: "Lera Crowfield", tag: "LC", ps: 1219, delta: 12, family: "Vorona" },
  { rank: 4, name: "Mostro Blaze", tag: "MB", ps: 1198, delta: 0, family: "Castello" },
  { rank: 5, name: "Sasha Outlawe", tag: "SO", ps: 1166, delta: 31, family: "Iron Vale" },
  { rank: 6, name: "Drago Finch", tag: "DF", ps: 1140, delta: -15, family: "Nightline" },
  { rank: 7, name: "Vega Stormaire", tag: "VS", ps: 1102, delta: 6, family: "Salt & Bone" },
  { rank: 8, name: "Toxa Renley", tag: "TR", ps: 1085, delta: -3, family: "Echo Roost" },
  { rank: 9, name: "Kira Wolfden", tag: "KW", ps: 1061, delta: 18, family: "Black Reef" },
  { rank: 10, name: "Ozzy Marchetti", tag: "OM", ps: 1040, delta: 0, family: "Vorona" },
  { rank: 11, name: "Ruby Ashgate", tag: "RA", ps: 1022, delta: -9, family: "Castello" },
  { rank: 12, name: "Bently Cruz", tag: "BC", ps: 998, delta: 4, family: "Iron Vale" },
  { rank: 13, name: "Sky Marrow", tag: "SM", ps: 974, delta: 15, family: "Nightline" },
  { rank: 14, name: "Vito Lazarro", tag: "VL", ps: 955, delta: -22, family: "Salt & Bone" },
  { rank: 15, name: "Nessa Quill", tag: "NQ", ps: 931, delta: 7, family: "Echo Roost" },
];

const families = [
  { rank: 1, name: "Vorona", tag: "VR", influence: 1180, delta: 60, members: 24 },
  { rank: 2, name: "Black Reef", tag: "BR", influence: 902, delta: 15, members: 22 },
  { rank: 3, name: "Castello", tag: "CS", influence: 781, delta: -20, members: 20 },
  { rank: 4, name: "Iron Vale", tag: "IV", influence: 654, delta: 40, members: 19 },
  { rank: 5, name: "Nightline", tag: "NL", influence: 512, delta: 0, members: 18 },
  { rank: 6, name: "Salt & Bone", tag: "SB", influence: 470, delta: -5, members: 17 },
  { rank: 7, name: "Echo Roost", tag: "ER", influence: 398, delta: 22, members: 16 },
  { rank: 8, name: "Greywatch", tag: "GW", influence: 365, delta: -10, members: 15 },
  { rank: 9, name: "Hollow Point", tag: "HP", influence: 340, delta: 5, members: 18 },
  { rank: 10, name: "Velvet Crown", tag: "VC", influence: 312, delta: 28, members: 14 },
  { rank: 11, name: "Last Light", tag: "LL", influence: 290, delta: -8, members: 13 },
  { rank: 12, name: "Driftwood", tag: "DW", influence: 265, delta: 0, members: 12 },
  { rank: 13, name: "Marrow Co.", tag: "MC", influence: 240, delta: 11, members: 12 },
  { rank: 14, name: "Cold Harbor", tag: "CH", influence: 218, delta: -14, members: 11 },
];

const capts = [
  { time: "сегодня, 21:40", a: "Vorona", b: "Black Reef", scoreA: 3, scoreB: 1 },
  { time: "сегодня, 19:15", a: "Iron Vale", b: "Salt & Bone", scoreA: 2, scoreB: 2 },
  { time: "сегодня, 17:02", a: "Castello", b: "Echo Roost", scoreA: 1, scoreB: 3 },
  { time: "вчера, 23:11", a: "Nightline", b: "Vorona", scoreA: 0, scoreB: 4 },
  { time: "вчера, 20:48", a: "Black Reef", b: "Iron Vale", scoreA: 3, scoreB: 0 },
  { time: "вчера, 18:30", a: "Echo Roost", b: "Salt & Bone", scoreA: 2, scoreB: 1 },
  { time: "12 июн, 22:05", a: "Vorona", b: "Castello", scoreA: 3, scoreB: 2 },
  { time: "12 июн, 19:50", a: "Salt & Bone", b: "Nightline", scoreA: 1, scoreB: 1 },
  { time: "12 июн, 18:20", a: "Greywatch", b: "Hollow Point", scoreA: 2, scoreB: 3 },
  { time: "12 июн, 16:05", a: "Velvet Crown", b: "Last Light", scoreA: 4, scoreB: 0 },
  { time: "11 июн, 22:40", a: "Driftwood", b: "Marrow Co.", scoreA: 1, scoreB: 2 },
  { time: "11 июн, 20:10", a: "Cold Harbor", b: "Echo Roost", scoreA: 0, scoreB: 3 },
  { time: "11 июн, 18:55", a: "Black Reef", b: "Castello", scoreA: 2, scoreB: 2 },
  { time: "11 июн, 17:30", a: "Vorona", b: "Iron Vale", scoreA: 3, scoreB: 1 },
];

const news = [
  {
    tag: "Турнир",
    title: "Старт квалификаций RPCL",
    text: "186 семей начали путь к плей-офф сезона. Первые матчи прошли без серьёзных сюрпризов.",
    date: "13 июня"
  },
  {
    tag: "Обновление",
    title: "Изменения в системе рейтинга PS",
    text: "Скорректирован вес побед в каптах против топ-10 семей — теперь они приносят больше очков.",
    date: "12 июня"
  },
  {
    tag: "Карта",
    title: "Карта недели — Vinewood Hills",
    text: "Разбор ключевых точек и тактик для предстоящих матчей лиги от аналитиков.",
    date: "11 июня"
  },
  {
    tag: "Сервер",
    title: "Технические работы в ночь на понедельник",
    text: "Кратковременный перерыв в работе статистики, рейтинги обновятся с задержкой.",
    date: "10 июня"
  },
];

// ===== RENDER HELPERS =====

function deltaSpan(delta){
  if (delta > 0) return `<span class="delta up">+${delta}</span>`;
  if (delta < 0) return `<span class="delta down">${delta}</span>`;
  return `<span class="delta flat">—</span>`;
}

function renderPlayers(list = players, limit = null){
  const tbody = document.querySelector('#players-table tbody');
  if (!tbody) return;
  const data = limit ? list.slice(0, limit) : list;
  tbody.innerHTML = data.map(p => `
    <tr>
      <td><span class="rank-num ${p.rank === 1 ? 'top1' : ''}">${p.rank}</span></td>
      <td class="entity-name"><span class="entity-logo">${p.tag}</span>${p.name}</td>
      <td class="col-num">${p.ps}</td>
      <td class="col-num">${deltaSpan(p.delta)}</td>
    </tr>
  `).join('');
}

function renderFamilies(list = families, limit = null){
  const tbody = document.querySelector('#families-table tbody');
  if (!tbody) return;
  const data = limit ? list.slice(0, limit) : list;
  tbody.innerHTML = data.map(f => `
    <tr>
      <td><span class="rank-num ${f.rank === 1 ? 'top1' : ''}">${f.rank}</span></td>
      <td class="entity-name"><span class="entity-logo">${f.tag}</span>${f.name}</td>
      <td class="col-num">${f.influence.toLocaleString('ru-RU')}</td>
      <td class="col-num">${deltaSpan(f.delta)}</td>
    </tr>
  `).join('');
}

function renderCapts(list = capts, limit = null){
  const grid = document.querySelector('#capts-grid');
  if (!grid) return;
  const data = limit ? list.slice(0, limit) : list;
  grid.innerHTML = data.map(c => {
    const aWins = c.scoreA > c.scoreB;
    return `
      <div class="capt-card">
        <div class="capt-time">${c.time}</div>
        <div class="capt-matchup">
          <div class="capt-team ${aWins ? 'winner' : 'loser'}">
            <span>${c.a}</span><span class="capt-score">${c.scoreA}</span>
          </div>
          <div class="capt-team ${!aWins ? 'winner' : 'loser'}">
            <span>${c.b}</span><span class="capt-score">${c.scoreB}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderNews(){
  const grid = document.querySelector('#news-grid');
  grid.innerHTML = news.map(n => `
    <article class="news-card">
      <span class="news-tag">${n.tag}</span>
      <h3>${n.title}</h3>
      <p>${n.text}</p>
      <span class="news-date">${n.date}</span>
    </article>
  `).join('');
}

function renderTicker(){
  const track = document.querySelector('#ticker-track');
  const items = capts.map(c => {
    const aWins = c.scoreA > c.scoreB;
    const winner = aWins ? c.a : c.b;
    const loser = aWins ? c.b : c.a;
    const wScore = aWins ? c.scoreA : c.scoreB;
    const lScore = aWins ? c.scoreB : c.scoreA;
    return `
      <div class="ticker-item">
        <span class="ticker-time">${c.time}</span>
        <span class="ticker-winner">${winner} ${wScore}</span>
        <span class="ticker-vs">—</span>
        <span class="ticker-loser">${lScore} ${loser}</span>
      </div>
    `;
  }).join('');
  // duplicate for seamless loop
  track.innerHTML = items + items;
}

renderPlayers(players, 6);
renderFamilies(families, 7);
renderCapts(capts, 8);
renderNews();
renderTicker();
