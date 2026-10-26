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
    console.log("📺 Récupération du programme NBA beIN...");

    const response = await fetch("https://tv-sports.fr/basket/nba");

    if (!response.ok) {
      console.warn(`TV-Sports : HTTP ${response.status}`);
      return;
    }

    const html = await response.text();

    const text = html
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&#39;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const nbaMatches = out.filter(m => m.sport === "NBA");

    function simpleName(name) {
      return String(name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
    }

    function sameTeam(a, b) {
      const x = simpleName(a);
      const y = simpleName(b);

      if (!x || !y) return false;

      if (x === y) return true;
      if (x.includes(y)) return true;
      if (y.includes(x)) return true;

      return false;
    }

    /*
      On découpe la page à partir de chaque apparition
      de "Direct". Une petite zone contient normalement :
      heure + NBA + équipes + chaîne.
    */

    const directRegex = /(\d{1,2})h(\d{2})\s+Direct/gi;

    const positions = [];
    let found;

    while ((found = directRegex.exec(text)) !== null) {
      positions.push({
        index: found.index,
        hour: Number(found[1]),
        minute: Number(found[2])
      });
    }

    let confirmedCount = 0;

    for (let i = 0; i < positions.length; i++) {
      const current = positions[i];

      const nextIndex =
        i + 1 < positions.length
          ? positions[i + 1].index
          : Math.min(text.length, current.index + 800);

      const block = text.slice(
        current.index,
        Math.min(nextIndex, current.index + 800)
      );

      if (!/NBA/i.test(block)) continue;
      if (!/beIN SPORTS/i.test(block)) continue;

      /*
        Recherche d'un intitulé du type :
        Equipe A – Equipe B
      */

      const matchName = block.match(
        /NBA\s+([A-Za-zÀ-ÿ0-9 .'-]+?)\s+[–-]\s+([A-Za-zÀ-ÿ0-9 .'-]+?)(?=\s+beIN SPORTS|\s+NBA League Pass|\s+\d{1,2}h\d{2}|$)/i
      );

      if (!matchName) continue;

      const tvHome = matchName[1].trim();
      const tvAway = matchName[2].trim();

      /*
        Récupère la chaîne exacte :
        beIN SPORTS 1, 2 ou 3.
      */

      const channelMatch = block.match(
        /beIN SPORTS\s*([123])/i
      );

      const channel = channelMatch
        ? `beIN SPORTS ${channelMatch[1]}`
        : "beIN SPORTS";

      /*
        On cherche maintenant CE match précis
        dans les matchs NBA de Match FR.
      */

      for (const match of nbaMatches) {
        const normalOrder =
          sameTeam(match.home, tvHome) &&
          sameTeam(match.away, tvAway);

        const reverseOrder =
          sameTeam(match.home, tvAway) &&
          sameTeam(match.away, tvHome);

        if (!normalOrder && !reverseOrder) continue;

        /*
          Vérification de l'heure française.

          On accepte une petite marge car les sources
          peuvent parfois différer légèrement.
        */

        const matchDate = new Date(match.utc);

        const parisParts = new Intl.DateTimeFormat(
          "fr-FR",
          {
            timeZone: "Europe/Paris",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          }
        ).formatToParts(matchDate);

        const parisHour = Number(
          parisParts.find(p => p.type === "hour")?.value
        );

        const parisMinute = Number(
          parisParts.find(p => p.type === "minute")?.value
        );

        const appMinutes =
          parisHour * 60 + parisMinute;

        const tvMinutes =
          current.hour * 60 + current.minute;

        let difference =
          Math.abs(appMinutes - tvMinutes);

        difference = Math.min(
          difference,
          1440 - difference
        );

        if (difference > 30) continue;

        match.tv = `${channel} • NBA League Pass`;

        console.log(
          `📺 ${channel} confirmé : ${match.home} - ${match.away}`
        );

        confirmedCount++;
        break;
      }
    }

    console.log(
      `📺 ${confirmedCount} match(s) NBA beIN confirmé(s)`
    );

  } catch (e) {
    console.warn("TV-Sports :", e.message);
  }
}
await Promise.all([football(),nba()]);
await addBeinBroadcasters();
out.sort((a,b)=>new Date(a.utc)-new Date(b.utc));
await fs.writeFile(new URL('./matches.json', import.meta.url), JSON.stringify(out,null,2)+'\n');
await fs.writeFile(new URL('./last-update.json', import.meta.url), JSON.stringify({updatedAt:new Date().toISOString(),count:out.length},null,2)+'\n');
console.log(`${out.length} matchs enregistrés`);
