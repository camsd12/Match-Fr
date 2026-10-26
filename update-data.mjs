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

function nbaLogo(team) {
  let abbr = team?.abbreviation?.toLowerCase();

  if (abbr === "uta") abbr = "utah";

  return abbr
    ? `https://a.espncdn.com/i/teamlogos/nba/500/${abbr}.png`
    : "🏀";
}
async function nba() {
  const apiKey = process.env.BALLDONTLIE_API_KEY;

  if (!apiKey) {
    console.warn("NBA: BALLDONTLIE_API_KEY absente");
    return;
  }

  try {
    const url =
      `https://api.balldontlie.io/v1/games?start_date=${from}&end_date=${to}&per_page=100`;

    const r = await fetch(url, {
      headers: {
        Authorization: apiKey
      }
    });

    if (!r.ok) {
      console.warn(`NBA BALLDONTLIE: HTTP ${r.status}`);
      return;
    }

    const j = await r.json();
    const games = j.data || [];

    for (const g of games) {
      const raw = g.datetime || g.date;
      if (!raw) continue;

      const dt = new Date(raw);
      if (Number.isNaN(dt.valueOf())) continue;

      const h = g.home_team || {};
      const a = g.visitor_team || {};

      out.push({
        id: `nba-${g.id}`,
        sport: "NBA",
        comp: "NBA",
        home: h.full_name || h.name || "Home",
        away: a.full_name || a.name || "Away",
        homeIcon: nbaLogo(h),
        awayIcon: nbaLogo(a),
        utc: dt.toISOString(),
        status: g.status_state || g.status || "scheduled",
        tv: "NBA League Pass",
        source: "BALLDONTLIE"
      });
    }

    console.log(`${games.length} matchs NBA récupérés`);
  } catch (e) {
    console.warn("NBA BALLDONTLIE:", e.message);
  }
}
function normalizeTeamName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
async function addBeinBroadcasters() {
  try {
    // On récupère d'abord le guide beIN pour obtenir
    // automatiquement l'URL actuelle de l'API TV.
    const guide = await fetch("https://www.beinsports.com/fr-fr/tv-guide");

    if (!guide.ok) {
      console.warn(`beIN guide : HTTP ${guide.status}`);
      return;
    }

    const html = await guide.text();

   // Récupère les identifiants UUID présents autour des chaînes beIN.
const channelIds = [];

const uuidRegex =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

const uuidMatches = [...html.matchAll(uuidRegex)];

for (const m of uuidMatches) {
  const id = m[0];

  const pos = m.index ?? 0;
  const startZone = Math.max(0, pos - 500);
  const endZone = Math.min(html.length, pos + 500);

  const zone = html.slice(startZone, endZone).toLowerCase();

  if (
    zone.includes("bein sports") ||
    zone.includes("bein_sports") ||
    zone.includes("beinsports")
  ) {
    channelIds.push(id);
  }
}

const uniqueChannelIds = [...new Set(channelIds)];

console.log(
  `beIN : ${uniqueChannelIds.length} identifiant(s) de chaîne trouvé(s)`
);

if (!uniqueChannelIds.length) {
  console.warn("beIN : aucun identifiant de chaîne trouvé");
  return;
}

    // Même période que les matchs déjà récupérés par Match FR.
    const nbaMatches = out.filter(m => m.sport === "NBA");

    if (!nbaMatches.length) return;

    const dates = nbaMatches
      .map(m => new Date(m.utc))
      .filter(d => !Number.isNaN(d.valueOf()));

    const start = new Date(Math.min(...dates.map(d => d.valueOf())));
    const end = new Date(Math.max(...dates.map(d => d.valueOf())));

    // Petite marge autour de la période.
    start.setHours(start.getHours() - 12);
    end.setHours(end.getHours() + 12);

    const params = new URLSearchParams();

    params.set(
      "sportTypeId",
      "1DDBCE01-E204-49F7-9153-933B230CC217"
    );

    params.set("startBefore", end.toISOString());
    params.set("endAfter", start.toISOString());
    params.set("limit", "3000");

    for (const id of uniqueChannelIds) {
      params.append("channelIds", id);
    }

    const apiUrl =
      `https://www.beinsports.com/api/opta/tv-event?${params.toString()}`;

    const r = await fetch(apiUrl);

    if (!r.ok) {
  const errorText = await r.text();

  console.warn(`beIN API : HTTP ${r.status}`);
  console.warn(`beIN API URL : ${apiUrl}`);
  console.warn(`beIN API réponse : ${errorText}`);

  return;
}

    const data = await r.json();

    // On transforme tout le JSON en texte normalisé.
    // Les équipes doivent apparaître dans LE MÊME événement.
    const events = Array.isArray(data)
      ? data
      : data?.data ||
        data?.items ||
        data?.events ||
        data?.results ||
        [];

    console.log(`beIN : ${events.length} événement(s) reçu(s)`);

    for (const match of nbaMatches) {
      const home = normalizeTeamName(match.home);
      const away = normalizeTeamName(match.away);

      if (!home || !away) continue;

      const matchTime = new Date(match.utc).getTime();

      const found = events.some(event => {
        const text = normalizeTeamName(JSON.stringify(event));

        if (!text.includes(home) || !text.includes(away)) {
          return false;
        }

        // Si une date beIN est trouvée, elle doit correspondre
        // au match NBA à quelques heures près.
        const dateCandidates = [
          event?.startDate,
          event?.startTime,
          event?.start,
          event?.date,
          event?.scheduledStart
        ].filter(Boolean);

        if (!dateCandidates.length) {
          return true;
        }

        return dateCandidates.some(value => {
          const t = new Date(value).getTime();
          return (
            !Number.isNaN(t) &&
            Math.abs(t - matchTime) <= 6 * 60 * 60 * 1000
          );
        });
      });

      if (found) {
        match.tv = "beIN SPORTS • NBA League Pass";

        console.log(
          `📺 beIN confirmé : ${match.home} - ${match.away}`
        );
      }
    }
  } catch (e) {
    console.warn("beIN API :", e.message);
  }
}

await Promise.all([football(),nba()]);
await addBeinBroadcasters();
out.sort((a,b)=>new Date(a.utc)-new Date(b.utc));
await fs.writeFile(new URL('./matches.json', import.meta.url), JSON.stringify(out,null,2)+'\n');
await fs.writeFile(new URL('./last-update.json', import.meta.url), JSON.stringify({updatedAt:new Date().toISOString(),count:out.length},null,2)+'\n');
console.log(`${out.length} matchs enregistrés`);
