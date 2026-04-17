// ── 상수 ──────────────────────────────────────────
const API_URL = 'https://wobble-api.chlgkrud981109.workers.dev';
const EXPERIMENT_START = new Date('2026-04-16T00:00:00Z');
const CURRENT_CO2_PPM  = 424.2;
const HP_MIN_PPM       = 500;
const HP_MAX_PPM       = 350;

const ACTIONS = {
  heal: [
    { icon: '🚌', name: 'Take transit',     co2: 0.21 },
    { icon: '🥗', name: 'Eat plant-based',  co2: 0.50 },
    { icon: '🧴', name: 'Use a tumbler',    co2: 0.10 },
    { icon: '🔌', name: 'Save electricity', co2: 0.18 },
    { icon: '🚲', name: 'Walk or cycle',    co2: 0.32 },
  ],
  harm: [
    { icon: '🚗', name: 'Short car trip',     co2: 2.40 },
    { icon: '🥩', name: 'Eat beef',           co2: 5.00 },
    { icon: '👗', name: 'Fast fashion',       co2: 3.00 },
    { icon: '❄️', name: 'Blast the A/C',      co2: 1.20 },
    { icon: '🥡', name: 'Single-use plastic', co2: 0.30 },
  ]
};

// ── 상태 ──────────────────────────────────────────
let state = {
  healCount: 0,
  harmCount: 0,
  hp: calcHP(CURRENT_CO2_PPM),
};

function calcHP(ppm) {
  const hp = ((HP_MIN_PPM - ppm) / (HP_MIN_PPM - HP_MAX_PPM)) * 100;
  return Math.max(0, Math.min(100, Math.round(hp * 100) / 100));
}

function updateTimer() {
  const now  = new Date();
  const diff = Math.floor((now - EXPERIMENT_START) / 1000);
  if (diff < 0) {
    document.getElementById('timer').textContent = 'Launching soon...';
    return;
  }
  const days = Math.floor(diff / 86400);
  const hrs  = Math.floor((diff % 86400) / 3600).toString().padStart(2, '0');
  const mins = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
  const secs = (diff % 60).toString().padStart(2, '0');
  document.getElementById('timer').textContent = `Day ${days} · ${hrs}:${mins}:${secs}`;
}

function fmt(n) {
  return Math.round(n).toLocaleString();
}

function updateUI() {
  const total   = state.healCount + state.harmCount;
  const healPct = total > 0 ? Math.round((state.healCount / total) * 100) : 50;
  const harmPct = 100 - healPct;

  document.getElementById('heal-count').textContent = fmt(state.healCount);
  document.getElementById('harm-count').textContent = fmt(state.harmCount);
  document.getElementById('participant-count').textContent = `${fmt(total)} participants`;

  document.getElementById('ratio-heal').style.width = healPct + '%';
  document.getElementById('ratio-harm').style.width = harmPct + '%';
  document.getElementById('heal-pct').textContent   = `Heal ${healPct}%`;
  document.getElementById('harm-pct').textContent   = `Harm ${harmPct}%`;

  const hp = state.hp;
  document.getElementById('hp-fill').style.width = hp.toFixed(1) + '%';
  document.getElementById('hp-text').textContent  = `${hp.toFixed(1)}% · ${CURRENT_CO2_PPM} ppm CO₂`;

  const fill = document.getElementById('hp-fill');
  if (hp <= 25)      fill.style.background = '#888780';
  else if (hp <= 50) fill.style.background = '#e08a3a';
  else if (hp <= 75) fill.style.background = '#4fa3e0';
  else               fill.style.background = '#3ab87a';

  const msg = document.getElementById('status-msg');
  if (total === 0) {
    msg.textContent = 'Experiment is just beginning...';
    msg.style.color = '#4a6a8a';
  } else if (healPct > 55) {
    msg.textContent = 'Humanity is currently healing the Earth';
    msg.style.color = '#3ab87a';
  } else if (harmPct > 55) {
    msg.textContent = 'Humanity is currently harming the Earth';
    msg.style.color = '#e05a4a';
  } else {
    msg.textContent = 'Humanity has not decided yet';
    msg.style.color = '#e08a3a';
  }

  updateEarthVisual(hp);
}

function updateEarthVisual(hp) {
  const ocean       = document.getElementById('ocean');
  const conts       = ['cont1','cont2','cont3','cont4'];
  const iceS        = document.getElementById('ice-s');
  const iceN        = document.getElementById('ice-n');
  const mouth       = document.getElementById('mouth');
  const eyeL        = document.getElementById('eye-l');
  const eyeR        = document.getElementById('eye-r');
  const bandage     = document.getElementById('bandage');
  const bandageLine = document.getElementById('bandage-line');

  if (hp <= 25) {
    ocean.setAttribute('fill', '#3a3a4a');
    conts.forEach(id => document.getElementById(id).setAttribute('fill', '#2a2a2a'));
    mouth.setAttribute('d', 'M82 118 Q91 112 100 118 Q109 124 118 118');
    eyeL.setAttribute('d', 'M72 74 L82 80 M82 74 L72 80');
    eyeR.setAttribute('d', 'M114 74 L124 80 M124 74 L114 80');
    iceS.setAttribute('opacity', '0.1');
    iceN.setAttribute('opacity', '0.1');
    bandage.setAttribute('opacity', '1');
    bandageLine.setAttribute('opacity', '1');
  } else if (hp <= 50) {
    ocean.setAttribute('fill', '#2a4a6a');
    conts.forEach(id => document.getElementById(id).setAttribute('fill', '#2a5c3a'));
    mouth.setAttribute('d', 'M80 116 Q100 108 120 116');
    eyeL.setAttribute('d', 'M74 76 Q79 70 84 76');
    eyeR.setAttribute('d', 'M116 76 Q121 70 126 76');
    iceS.setAttribute('opacity', '0.5');
    iceN.setAttribute('opacity', '0.3');
    bandage.setAttribute('opacity', '1');
    bandageLine.setAttribute('opacity', '1');
  } else if (hp <= 75) {
    ocean.setAttribute('fill', '#1a5a8a');
    conts.forEach(id => document.getElementById(id).setAttribute('fill', '#1a7a3a'));
    mouth.setAttribute('d', 'M80 112 Q100 124 120 112');
    eyeL.setAttribute('d', 'M74 76 Q79 70 84 76');
    eyeR.setAttribute('d', 'M116 76 Q121 70 126 76');
    iceS.setAttribute('opacity', '0.7');
    iceN.setAttribute('opacity', '0.6');
    bandage.setAttribute('opacity', '0');
    bandageLine.setAttribute('opacity', '0');
  } else {
    ocean.setAttribute('fill', '#1a6aaa');
    conts.forEach(id => document.getElementById(id).setAttribute('fill', '#1a9a4a'));
    mouth.setAttribute('d', 'M76 110 Q100 128 124 110');
    eyeL.setAttribute('d', 'M74 78 Q79 70 84 78');
    eyeR.setAttribute('d', 'M116 78 Q121 70 126 78');
    iceS.setAttribute('opacity', '0.9');
    iceN.setAttribute('opacity', '0.85');
    bandage.setAttribute('opacity', '0');
    bandageLine.setAttribute('opacity', '0');
  }
}

function showFloatingText(type, co2) {
  const earth = document.getElementById('wobble-earth');
  const rect  = earth.getBoundingClientRect();
  const el    = document.createElement('div');
  el.textContent = type === 'heal'
    ? `-${co2.toFixed(2)} kg CO₂`
    : `+${co2.toFixed(2)} kg CO₂`;
  el.style.cssText = `
    position: fixed;
    left: ${rect.left + rect.width / 2}px;
    top: ${rect.top + 20}px;
    transform: translateX(-50%);
    font-size: 13px;
    font-weight: 500;
    pointer-events: none;
    z-index: 200;
    color: ${type === 'heal' ? '#3ab87a' : '#e05a4a'};
    animation: floatUp 1.2s ease forwards;
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function handleClick(type, co2) {
  const HP_PER_KG = 1 / (8000000000 * 150 * 10000);
  if (type === 'heal') {
    state.healCount++;
    state.hp = Math.min(100, state.hp + co2 * HP_PER_KG * 100);
    triggerHealAnim();
  } else {
    state.harmCount++;
    state.hp = Math.max(0, state.hp - co2 * HP_PER_KG * 100);
    triggerHarmAnim();
  }
  showFloatingText(type, co2);
  updateUI();
  sendToAPI(type, co2);
}

function triggerHealAnim() {
  const el = document.getElementById('wobble-earth');
  el.classList.remove('wobble-anim', 'heal-anim');
  void el.offsetWidth;
  el.classList.add('heal-anim');
}
function triggerHarmAnim() {
  const el = document.getElementById('wobble-earth');
  el.classList.remove('wobble-anim', 'heal-anim');
  void el.offsetWidth;
  el.classList.add('wobble-anim');
}

function shareAction() {
  const total   = state.healCount + state.harmCount;
  const healPct = total > 0 ? Math.round((state.healCount / total) * 100) : 50;
  const text    = `I just made my choice on Wobble — the global Earth experiment.\nCurrently: Humanity heals ${healPct}% vs harms ${100 - healPct}%.\nWhat will you choose? wobble.earth #WobbleEarth`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
}

async function sendToAPI(type, co2) {
  try {
    await fetch(`${API_URL}/api/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, co2 })
    });
  } catch (e) {
    console.warn('API error:', e);
  }
}

async function syncGlobalState() {
  try {
    const res  = await fetch(`${API_URL}/api/state`);
    const data = await res.json();
    state.healCount = data.healCount;
    state.harmCount = data.harmCount;
    // 실제 CO₂ 데이터로 HP 업데이트
    if (data.co2Ppm) {
      document.getElementById('co2-val').textContent = data.co2Ppm.toFixed(1) + ' ppm';
      state.hp = data.hp;
    }
    updateUI();
    updateCountryList(data.topCountries);
    if (data.news) updateNewsList(data.news);
  } catch (e) {
    console.warn('Sync failed:', e);
  }
}

function updateCountryList(countries) {
  if (!countries || countries.length === 0) return;
  const flags = {
    KR:'🇰🇷', US:'🇺🇸', JP:'🇯🇵', DE:'🇩🇪', GB:'🇬🇧',
    FR:'🇫🇷', CN:'🇨🇳', IN:'🇮🇳', BR:'🇧🇷', CA:'🇨🇦',
    AU:'🇦🇺', NL:'🇳🇱', SE:'🇸🇪', SG:'🇸🇬', MX:'🇲🇽',
  };
  const el = document.getElementById('country-list');
  el.innerHTML = countries.map(c => `
    <div class="country-row">
      <span class="country-name">${flags[c.country] || '🌍'} ${c.country}</span>
      <span class="country-pct">${c.healPct}% heal</span>
    </div>
  `).join('');
}

function updateNewsList(news) {
  if (!news || news.length === 0) return;
  const el = document.getElementById('news-list');
  if (!el) return;
  el.innerHTML = news.map(n => `
    <div class="news-item">
      <a href="${n.url}" target="_blank" rel="noopener" style="color: inherit; text-decoration: none;">
        ${n.title}
      </a>
      <div class="news-src">${n.source} · ${n.date}</div>
    </div>
  `).join('');
}

// ── 초기화 ──────────────────────────────────────
updateUI();
setInterval(updateTimer, 1000);
updateTimer();
setInterval(syncGlobalState, 5000);
syncGlobalState();