// Wobble — Cloudflare Workers API
// KV 구조:
//   wobble:heal      → 누적 치료 클릭 수
//   wobble:harm      → 누적 나쁜 행동 클릭 수
//   wobble:countries → { KR: {heal:0, harm:0}, ... }
//   wobble:co2       → 최신 CO₂ ppm 값

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

let buffer = { heal: 0, harm: 0, countries: {} };
let lastFlush = Date.now();
const FLUSH_INTERVAL = 60 * 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (request.method === 'POST' && url.pathname === '/api/click') {
      return handleClick(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/api/state') {
      return handleState(env);
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env) {
    // 매 1분마다 실행
    await flushBuffer(env);

    // 매일 오전 12시 (UTC 15:00 = KST 00:00)에 CO₂ 업데이트
    const now = new Date();
    if (now.getUTCHours() === 15 && now.getUTCMinutes() < 2) {
      await updateCO2(env);
    }
  }
};

// ── CO₂ 업데이트 (NOAA API) ──────────────────────
async function updateCO2(env) {
  try {
    // NOAA GML 최신 CO₂ 데이터 (Mauna Loa 관측소)
    const res  = await fetch('https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_weekly_mlo.csv');
    const text = await res.text();

    // CSV 파싱 — 마지막 유효 행에서 ppm 추출
    const lines = text.trim().split('\n').filter(l => !l.startsWith('#') && l.trim());
    const last  = lines[lines.length - 1].split(',');
    const ppm   = parseFloat(last[4]); // 5번째 컬럼이 ppm

    if (!isNaN(ppm) && ppm > 300 && ppm < 600) {
      await env.WOBBLE_KV.put('wobble:co2', String(ppm));
      console.log(`CO₂ updated: ${ppm} ppm`);
    }
  } catch (e) {
    console.error('CO₂ update failed:', e);
  }
}

// ── 클릭 처리 ──────────────────────────────────
async function handleClick(request, env) {
  try {
    const { type, co2 } = await request.json();
    if (!['heal', 'harm'].includes(type)) {
      return json({ error: 'invalid type' }, 400);
    }

    const country = request.cf?.country || 'XX';

    buffer[type]++;
    if (!buffer.countries[country]) {
      buffer.countries[country] = { heal: 0, harm: 0 };
    }
    buffer.countries[country][type]++;

    if (Date.now() - lastFlush > FLUSH_INTERVAL) {
      await flushBuffer(env);
    }

    return json({ ok: true, type, country });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── 상태 조회 ──────────────────────────────────
async function handleState(env) {
  try {
    const [healVal, harmVal, countriesVal, co2Val] = await Promise.all([
      env.WOBBLE_KV.get('wobble:heal'),
      env.WOBBLE_KV.get('wobble:harm'),
      env.WOBBLE_KV.get('wobble:countries'),
      env.WOBBLE_KV.get('wobble:co2'),
    ]);

    const healCount   = (parseInt(healVal) || 0) + buffer.heal;
    const harmCount   = (parseInt(harmVal) || 0) + buffer.harm;
    const kvCountries = countriesVal ? JSON.parse(countriesVal) : {};
    const co2Ppm      = parseFloat(co2Val) || 424.2;

    // HP 계산
    const hp = Math.max(0, Math.min(100,
      ((500 - co2Ppm) / (500 - 350)) * 100
    ));

    const countries = { ...kvCountries };
    for (const [cc, data] of Object.entries(buffer.countries)) {
      if (!countries[cc]) countries[cc] = { heal: 0, harm: 0 };
      countries[cc].heal += data.heal;
      countries[cc].harm += data.harm;
    }

    const topCountries = Object.entries(countries)
      .map(([cc, data]) => ({
        country: cc,
        heal: data.heal,
        harm: data.harm,
        total: data.heal + data.harm,
        healPct: data.heal + data.harm > 0
          ? Math.round((data.heal / (data.heal + data.harm)) * 100)
          : 50
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return json({
      healCount,
      harmCount,
      total: healCount + harmCount,
      healPct: healCount + harmCount > 0
        ? Math.round((healCount / (healCount + harmCount)) * 100)
        : 50,
      co2Ppm,
      hp: Math.round(hp * 10) / 10,
      topCountries,
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── KV 플러시 ──────────────────────────────────
async function flushBuffer(env) {
  if (buffer.heal === 0 && buffer.harm === 0) return;

  try {
    const [healVal, harmVal, countriesVal] = await Promise.all([
      env.WOBBLE_KV.get('wobble:heal'),
      env.WOBBLE_KV.get('wobble:harm'),
      env.WOBBLE_KV.get('wobble:countries'),
    ]);

    const newHeal     = (parseInt(healVal) || 0) + buffer.heal;
    const newHarm     = (parseInt(harmVal) || 0) + buffer.harm;
    const kvCountries = countriesVal ? JSON.parse(countriesVal) : {};

    for (const [cc, data] of Object.entries(buffer.countries)) {
      if (!kvCountries[cc]) kvCountries[cc] = { heal: 0, harm: 0 };
      kvCountries[cc].heal += data.heal;
      kvCountries[cc].harm += data.harm;
    }

    await Promise.all([
      env.WOBBLE_KV.put('wobble:heal', String(newHeal)),
      env.WOBBLE_KV.put('wobble:harm', String(newHarm)),
      env.WOBBLE_KV.put('wobble:countries', JSON.stringify(kvCountries)),
    ]);

    buffer = { heal: 0, harm: 0, countries: {} };
    lastFlush = Date.now();
  } catch (e) {
    console.error('Flush error:', e);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}