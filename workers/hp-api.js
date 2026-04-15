// Wobble — Cloudflare Workers API
// KV 구조:
//   wobble:heal  → 누적 치료 클릭 수
//   wobble:harm  → 누적 나쁜 행동 클릭 수
//   wobble:countries → { KR: {heal:0, harm:0}, US: {...}, ... }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 메모리 버퍼 (1분마다 KV에 플러시)
let buffer = { heal: 0, harm: 0, countries: {} };
let lastFlush = Date.now();
const FLUSH_INTERVAL = 60 * 1000; // 1분

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    // POST /api/click — 클릭 집계
    if (request.method === 'POST' && url.pathname === '/api/click') {
      return handleClick(request, env);
    }

    // GET /api/state — 현재 상태 조회
    if (request.method === 'GET' && url.pathname === '/api/state') {
      return handleState(env);
    }

    return new Response('Not found', { status: 404 });
  },

  // 1분마다 버퍼를 KV에 플러시
  async scheduled(event, env) {
    await flushBuffer(env);
  }
};

// ── 클릭 처리 ──────────────────────────────────
async function handleClick(request, env) {
  try {
    const { type, co2 } = await request.json();
    if (!['heal', 'harm'].includes(type)) {
      return json({ error: 'invalid type' }, 400);
    }

    // 국가 감지 (Cloudflare 자동 제공)
    const country = request.cf?.country || 'XX';

    // 메모리 버퍼에 누적
    buffer[type]++;
    if (!buffer.countries[country]) {
      buffer.countries[country] = { heal: 0, harm: 0 };
    }
    buffer.countries[country][type]++;

    // 1분 지났으면 KV에 플러시
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
    const [healVal, harmVal, countriesVal] = await Promise.all([
      env.WOBBLE_KV.get('wobble:heal'),
      env.WOBBLE_KV.get('wobble:harm'),
      env.WOBBLE_KV.get('wobble:countries'),
    ]);

    const healCount     = (parseInt(healVal) || 0) + buffer.heal;
    const harmCount     = (parseInt(harmVal) || 0) + buffer.harm;
    const kvCountries   = countriesVal ? JSON.parse(countriesVal) : {};

    // 버퍼 국가 데이터 병합
    const countries = { ...kvCountries };
    for (const [cc, data] of Object.entries(buffer.countries)) {
      if (!countries[cc]) countries[cc] = { heal: 0, harm: 0 };
      countries[cc].heal += data.heal;
      countries[cc].harm += data.harm;
    }

    // 국가별 치료 기여도 TOP 5
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

    const newHeal      = (parseInt(healVal) || 0) + buffer.heal;
    const newHarm      = (parseInt(harmVal) || 0) + buffer.harm;
    const kvCountries  = countriesVal ? JSON.parse(countriesVal) : {};

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

    // 버퍼 초기화
    buffer = { heal: 0, harm: 0, countries: {} };
    lastFlush = Date.now();
  } catch (e) {
    console.error('Flush error:', e);
  }
}

// ── 헬퍼 ──────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}