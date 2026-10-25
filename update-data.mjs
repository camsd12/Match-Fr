import fs from 'node:fs/promises';

const token = process.env.FOOTBALL_DATA_TOKEN;
const footballCompetitions = [
  ['FL1','Ligue 1'], ['FL2','Ligue 2'], ['CL','Ligue des champions'],
  ['EL','Ligue Europa'], ['EC','Ligue Conférence'], ['PL','Premier League'],
  ['PD','Liga'], ['SA','Serie A'], ['BL1','Bundesliga']
];
const now = new Date();
const from = now.toISOString().slice(0,10);
const toDate = new Date(now); toDate.setUTCDate(toDate.getUTCDate()+14);
const to = toDate.toISOString().slice(0,10);
const out = [];

function frenchBroadcaster(code) {
  const broadcasters = {
    FL1: 'Ligue 1+',
    FL2: 'beIN SPORTS',
    CL: 'CANAL+',
    EL: 'CANAL+',
    EC: 'CANAL+',
    PL: 'CANAL+',
    PD: 'DAZN / Disney+',
    SA: 'DAZN',
    BL1: 'beIN SPORTS'
  };

  return broadcasters[code] || 'Diffuseur FR à confirmer';
}

async function football() {
  if (!token) { console.warn('FOOTBALL_DATA_TOKEN absent: football ignoré'); return; }
  for (const [code,label] of footballCompetitions) {
    try {
      const u = `https://api.football-data.org/v4/competitions/${code}/matches?dateFrom=${from}&dateTo=${to}`;
      const r = await fetch(u,{headers:{'X-Auth-Token':token}});
      if (!r.ok) { console.warn(`${label}: HTTP ${r.status} (peut ne pas être inclus dans le forfait gratuit)`); continue; }
      const j = await r.json();
      for (const m of (j.matches||[])) {
        if (['CANCELLED'].includes(m.status)) continue;
        out.push({
          id:`fd-${m.id}`, sport:'Football', comp:label,
          home:m.homeTeam?.shortName||m.homeTeam?.name||'À confirmer',
          away:m.awayTeam?.shortName||m.awayTeam?.name||'À confirmer',
          homeIcon:m.homeTeam?.crest||'', awayIcon:m.awayTeam?.crest||'',
          utc:m.utcDate, status:m.status||'SCHEDULED', tv: frenchBroadcaster(code), source:'football-data.org'
        });
      }
    } catch(e) { console.warn(label, e.message); }
  }
}

async function nba() {
  const url = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json';

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.nba.com',
        'Referer': 'https://www.nba.com/'
      }
    });

    if (!r.ok) {
      console.warn(`NBA: HTTP ${r.status}`);
      return;
    }

    const j = await r.json();
    const dates = j?.leagueSchedule?.gameDates || [];

    const limit = new Date(toDate);
    limit.setUTCDate(limit.getUTCDate() + 1);

    for (const d of dates) {
      for (const g of (d.games || [])) {
        const raw = g.gameDateTimeUTC || g.gameDateTimeEst || g.gameDateTimeUTCString;
        if (!raw) continue;

        const dt = new Date(raw);
        if (Number.isNaN(dt.valueOf()) || dt < now || dt > limit) continue;

        const h = g.homeTeam || {};
        const a = g.awayTeam || {};

        out.push({
          id: `nba-${g.gameId}`,
          sport: 'NBA',
          comp: 'NBA',
          home: h.teamName || h.teamCity || 'Home',
          away: a.teamName || a.teamCity || 'Away',
          homeIcon: h.teamId ? `https://cdn.nba.com/logos/nba/${h.teamId}/primary/L/logo.png` : '🏀',
          awayIcon: a.teamId ? `https://cdn.nba.com/logos/nba/${a.teamId}/primary/L/logo.png` : '🏀',
          utc: dt.toISOString(),
          status: g.gameStatusText || 'Scheduled',
          tv: 'NBA League Pass',
          source: 'NBA'
        });
      }
    }
  } catch (e) {
    console.warn('NBA:', e.message);
  }
}


await Promise.all([football(),nba()]);
out.sort((a,b)=>new Date(a.utc)-new Date(b.utc));
await fs.writeFile(new URL('./matches.json', import.meta.url), JSON.stringify(out,null,2)+'\n');
await fs.writeFile(new URL('./last-update.json', import.meta.url), JSON.stringify({updatedAt:new Date().toISOString(),count:out.length},null,2)+'\n');
console.log(`${out.length} matchs enregistrés`);
