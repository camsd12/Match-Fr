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
    console.log("📺 Vérification beIN avec contrôle de la date...");

    const response = await fetch("https://tv-sports.fr/basket/nba");

    if (!response.ok) {
      console.warn(`TV-Sports : HTTP ${response.status}`);
      return;
    }

    const html = await response.text();
    const nbaMatches = out.filter(m => m.sport === "NBA");

    // Texte lisible de la page, sans scripts ni balises HTML.
    const cleanHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ");

    const page = normalizeTeamName(cleanHtml);

    const aliases = {
      philadelphia76ers: [
        "philadelphia76ers",
        "philadelphia",
        "76ers"
      ],

      portlandtrailblazers: [
        "portlandtrailblazers",
        "portland",
        "trailblazers"
      ],

      losangelesclippers: [
        "losangelesclippers",
        "laclippers",
        "clippers"
      ],

      losangeleslakers: [
        "losangeleslakers",
        "lalakers",
        "lakers"
      ],

      oklahomacitythunder: [
        "oklahomacitythunder",
        "oklahomacity",
        "thunder"
      ],

      goldenstatewarriors: [
        "goldenstatewarriors",
        "goldenstate",
        "warriors"
      ],

      newyorkknicks: [
        "newyorkknicks",
        "newyork",
        "knicks"
      ],

      sanantoniospurs: [
        "sanantoniospurs",
        "sanantonio",
        "spurs"
      ]
    };

    function teamNames(name) {
      const normalized = normalizeTeamName(name);
      return aliases[normalized] || [normalized];
    }

    function findPositions(text, names) {
      const positions = [];

      for (const name of names) {
        if (!name || name.length < 4) continue;

        let position = text.indexOf(name);

        while (position !== -1) {
          positions.push(position);

          position = text.indexOf(
            name,
            position + name.length
          );
        }
      }

      return [...new Set(positions)];
    }

    for (const match of nbaMatches) {
      const matchDate = new Date(match.utc);

      if (Number.isNaN(matchDate.valueOf())) continue;

      // Date du match telle qu'elle est vécue en France.
      // Exemple : un match du dimanche soir aux USA peut être
      // lundi matin en France.
      const dateParts = new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        day: "numeric",
        month: "long",
        year: "numeric"
      }).formatToParts(matchDate);

      const dayNumber =
        dateParts.find(p => p.type === "day")?.value || "";

      const month =
        dateParts.find(p => p.type === "month")?.value || "";

      const year =
        dateParts.find(p => p.type === "year")?.value || "";

      // Plusieurs écritures possibles de la date.
      const dateVariants = [
        normalizeTeamName(`${dayNumber} ${month} ${year}`),
        normalizeTeamName(`${dayNumber} ${month}`),
        normalizeTeamName(`${dayNumber}/${matchDate.toLocaleDateString(
          "fr-FR",
          {
            timeZone: "Europe/Paris",
            month: "2-digit"
          }
        )}`)
      ].filter(Boolean);

      const homeNames = teamNames(match.home);
      const awayNames = teamNames(match.away);

      const homePositions = findPositions(page, homeNames);
      const awayPositions = findPositions(page, awayNames);

      let confirmed = false;

      for (const homePos of homePositions) {
        for (const awayPos of awayPositions) {

          // Les deux équipes doivent vraiment appartenir
          // au même petit bloc de programme.
          if (Math.abs(homePos - awayPos) > 500) {
            continue;
          }

          const start = Math.max(
            0,
            Math.min(homePos, awayPos) - 500
          );

          const end = Math.min(
            page.length,
            Math.max(homePos, awayPos) + 500
          );

          const zone = page.slice(start, end);

          const hasBein =
            zone.includes("beinsports") ||
            zone.includes("bein1") ||
            zone.includes("bein2") ||
            zone.includes("bein3");

          if (!hasBein) continue;

          // NOUVEAU :
          // la date française doit également être présente
          // dans cette même zone.
          const hasCorrectDate =
            dateVariants.some(date =>
              date && zone.includes(date)
            );

          if (!hasCorrectDate) {
            continue;
          }

          confirmed = true;
          break;
        }

        if (confirmed) break;
      }

      if (confirmed) {
        match.tv = "beIN SPORTS • NBA League Pass";

        console.log(
          `📺 beIN confirmé : ${match.home} - ${match.away} (${dayNumber} ${month})`
        );
      }
    }

    console.log("📺 Vérification beIN terminée");

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
