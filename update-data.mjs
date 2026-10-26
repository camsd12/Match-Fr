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
    console.log("📺 Lecture des matchs NBA en direct sur TV-Sports...");

    const response = await fetch(
      "https://tv-sports.fr/basket/match-direct"
    );

    if (!response.ok) {
      console.warn(`TV-Sports : HTTP ${response.status}`);
      return;
    }

    const html = await response.text();
    onsole.log("🔎 DIAG TV-Sports : taille =", html.length);

const motsTest = [
  "beIN SPORTS",
  "Denver Nuggets",
  "Golden State Warriors",
  "Direct"
];

for (const mot of motsTest) {
  const position = html
    .toLowerCase()
    .indexOf(mot.toLowerCase());

  console.log(`🔎 DIAG "${mot}" = ${position}`);

  if (position !== -1) {
    const extrait = html
      .slice(
        Math.max(0, position - 300),
        position + 700
      )
      .replace(/\s+/g, " ");

    console.log(`🔎 EXTRAIT "${mot}" : ${extrait}`);
  }
}

    // Convertit le HTML en texte lisible
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&#39;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, " ")
      .trim();

    function normalise(value) {
      return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
    }

    // Texte normalisé de toute la page
    const page = normalise(text);

    // Date française YYYY-MM-DD
    function frenchDate(date) {
      const parts = new Intl.DateTimeFormat("fr-CA", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(date);

      const y = parts.find(p => p.type === "year").value;
      const m = parts.find(p => p.type === "month").value;
      const d = parts.find(p => p.type === "day").value;

      return `${y}-${m}-${d}`;
    }

    // J / J+1 / J+2
    const now = new Date();

    const parisToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);

    const year = Number(
      parisToday.find(p => p.type === "year").value
    );

    const month = Number(
      parisToday.find(p => p.type === "month").value
    );

    const day = Number(
      parisToday.find(p => p.type === "day").value
    );

    const allowedDays = new Set();

    for (let offset = 0; offset <= 2; offset++) {
      const d = new Date(
        Date.UTC(year, month - 1, day + offset, 12)
      );

      allowedDays.add(frenchDate(d));
    }

    console.log(
      "📅 Journées contrôlées :",
      [...allowedDays].join(" / ")
    );

    let confirmed = 0;

    const nbaMatches = out.filter(
      match => match.sport === "NBA"
    );

    for (const match of nbaMatches) {

      const date = new Date(match.utc);

      if (Number.isNaN(date.valueOf())) {
        continue;
      }

      // Seulement J à J+2
      if (!allowedDays.has(frenchDate(date))) {
        continue;
      }

      const home = normalise(match.home);
      const away = normalise(match.away);

      if (!home || !away) {
        continue;
      }

      /*
       * On cherche les deux équipes proches l'une
       * de l'autre dans la page TV-Sports.
       */

      let homePosition = page.indexOf(home);

      while (homePosition !== -1) {

        const start = Math.max(
          0,
          homePosition - 500
        );

        const end = Math.min(
          page.length,
          homePosition + home.length + away.length + 1000
        );

        const zone = page.slice(start, end);

        const hasAway =
          zone.includes(away);

        const hasNBA =
          zone.includes("nba");

        const hasDirect =
          zone.includes("direct");

        const beinMatch = zone.match(
          /beinsports(?:max)?(?:[0-9]+)?/
        );

        if (
          hasAway &&
          hasNBA &&
          hasDirect &&
          beinMatch
        ) {

          let channel = beinMatch[0];

          // Transforme le texte normalisé
          // en nom propre de chaîne.

          channel = channel
            .replace("beinsportsmax", "beIN SPORTS MAX ")
            .replace("beinsports", "beIN SPORTS ");

          channel = channel.trim();

          match.tv =
            `${channel} • NBA League Pass`;

          console.log(
            `📺 CONFIRMÉ : ${match.home} - ${match.away} → ${channel}`
          );

          confirmed++;
          break;
        }

        homePosition = page.indexOf(
          home,
          homePosition + home.length
        );
      }
    }

    console.log(
      `📺 ${confirmed} match(s) NBA beIN confirmé(s)`
    );

  } catch (e) {
    console.warn(
      "TV-Sports :",
      e.message
    );
  }
}
await Promise.all([football(),nba()]);
await addBeinBroadcasters();
out.sort((a,b)=>new Date(a.utc)-new Date(b.utc));
await fs.writeFile(new URL('./matches.json', import.meta.url), JSON.stringify(out,null,2)+'\n');
await fs.writeFile(new URL('./last-update.json', import.meta.url), JSON.stringify({updatedAt:new Date().toISOString(),count:out.length},null,2)+'\n');
console.log(`${out.length} matchs enregistrés`);
