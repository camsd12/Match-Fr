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
    const r = await fetch("https://www.beinsports.com/fr-fr/tv-guide");

    if (!r.ok) {
      console.warn(`beIN SPORTS: HTTP ${r.status}`);
      return;
    }

    const page = await r.text();
    console.log(`beIN SPORTS : __NEXT_DATA__=${page.includes("__NEXT_DATA__")}`);
    console.log(`beIN SPORTS : __NEXT_DATA__ position=${page.indexOf("__NEXT_DATA__")}`);
    console.log(`beIN SPORTS : après NEXT_DATA=${page.slice(page.indexOf("__NEXT_DATA__"), page.indexOf("__NEXT_DATA__") + 500)}`);
    console.log(`beIN SPORTS : pageProps position=${page.indexOf('"pageProps"')}`);
    const nextStart = page.indexOf('<script id="__NEXT_DATA__"');
const nextOpen = page.indexOf(">", nextStart) + 1;
const nextEnd = page.indexOf("</script>", nextOpen);

if (nextStart >= 0 && nextOpen > 0 && nextEnd > nextOpen) {
  try {
    const nextJsonText = page.slice(nextOpen, nextEnd);
    const nextData = JSON.parse(nextJsonText);
    const nextText = JSON.stringify(nextData);

    console.log(`beIN NEXT : JSON valide = oui`);
    console.log(`beIN NEXT : taille JSON = ${nextText.length}`);
    console.log(`beIN NEXT : NBA = ${nextText.toLowerCase().includes("nba")}`);
    console.log(`beIN NEXT : Lakers = ${nextText.toLowerCase().includes("lakers")}`);
    console.log(`beIN NEXT : Celtics = ${nextText.toLowerCase().includes("celtics")}`);
    console.log(`beIN NEXT : Warriors = ${nextText.toLowerCase().includes("warriors")}`);
    console.log(`beIN NEXT : Knicks = ${nextText.toLowerCase().includes("knicks")}`);
  } catch (e) {
    console.log(`beIN NEXT : erreur JSON = ${e.message}`);
  }
} else {
  console.log("beIN NEXT : bloc introuvable");
}
   const urlsFound = [...page.matchAll(/https?:\\?\/\\?\/[^"'<> ]+/g)]
  .map(m => m[0].replace(/\\\//g, "/"))
  .filter(url =>
    /api|schedule|guide|event|program|epg|fixture|match/i.test(url)
  );

const uniqueUrls = [...new Set(urlsFound)];

console.log(`beIN SOURCES : ${uniqueUrls.length} adresse(s) intéressante(s)`);

for (const url of uniqueUrls.slice(0, 20)) {
  console.log(`beIN SOURCE : ${url}`);
}
   const scriptMatches = [...page.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)];
const scriptUrls = [...new Set(
  scriptMatches.map(m => {
    const src = m[1];

    if (src.startsWith("http")) return src;
    if (src.startsWith("//")) return "https:" + src;
    if (src.startsWith("/")) return "https://www.beinsports.com" + src;

    return null;
  }).filter(Boolean)
)];

console.log(`beIN SCRIPTS : ${scriptUrls.length} script(s) trouvé(s)`);

for (const scriptUrl of scriptUrls.slice(0, 30)) {
  try {
    const sr = await fetch(scriptUrl);
    if (!sr.ok) continue;

    const js = await sr.text();
    const scheduledPos = js.indexOf("onsScheduledEvents");

if (scheduledPos >= 0) {
  console.log(`🎯 beIN SCHEDULE TROUVÉ : ${scriptUrl}`);
  console.log(`🎯 beIN SCHEDULE CODE : ${js.slice(Math.max(0, scheduledPos - 2000), scheduledPos + 4000)}`);
}


    if (/tv-guide|\/api\/|schedule|epg|broadcast|channel|programming/i.test(js)) {
      console.log(`beIN SCRIPT intéressant : ${scriptUrl}`);

      const words = ["tv-guide", "/api/", "schedule", "epg", "broadcast", "channel", "programming"];

      for (const word of words) {
        const pos = js.toLowerCase().indexOf(word);

        if (pos >= 0) {
          console.log(
            `beIN JS ${word} : ${js.slice(Math.max(0, pos - 250), pos + 500)}`
          );
        }
      }
    }
  } catch (e) {
    console.log(`beIN SCRIPT erreur : ${e.message}`);
  }
} 
    const nbaIndex = page.indexOf("NBA");
    const basketIndex = page.indexOf("Basket-ball");
    const displayIndex = page.indexOf('"display_name"');
    const shortNameIndex = page.indexOf('"short_name":"NBA"');
    console.log(`beIN SPORTS : position NBA=${nbaIndex}`);
    console.log(`beIN SPORTS : position Basket-ball=${basketIndex}`);
    console.log(`beIN SPORTS : position display_name=${displayIndex}`);
    console.log(`beIN SPORTS : position short_name NBA=${shortNameIndex}`);
    console.log(`beIN SPORTS : autour short_name NBA=${shortNameIndex >= 0 ? page.slice(Math.max(0, shortNameIndex - 1000), shortNameIndex + 1000) : "short_name NBA introuvable"}`);
    console.log(`beIN SPORTS : Lakers=${page.toLowerCase().includes("lakers")} Celtics=${page.toLowerCase().includes("celtics")} Knicks=${page.toLowerCase().includes("knicks")} Warriors=${page.toLowerCase().includes("warriors")}`);
    console.log(`beIN SPORTS : extrait display_name=${displayIndex >= 0 ? page.slice(displayIndex, displayIndex + 500) : "display_name introuvable"}`);
    console.log(`beIN SPORTS : extrait=${nbaIndex >= 0 ? page.slice(nbaIndex, nbaIndex + 500) : "NBA introuvable"}`);
    console.log(`beIN SPORTS : avant NBA=${nbaIndex >= 0 ? page.slice(Math.max(0, nbaIndex - 500), nbaIndex) : "NBA introuvable"}`);
    const normalizedPage = normalizeTeamName(page);

    for (const match of out) {
      if (match.sport !== "NBA") continue;

      const home = normalizeTeamName(match.home);
      const away = normalizeTeamName(match.away);

      if (
        home &&
        away &&
        normalizedPage.includes(home) &&
        normalizedPage.includes(away)
      ) {
        match.tv = "beIN SPORTS • NBA League Pass";
      }
    }

    console.log(`beIN SPORTS : page reçue (${page.length} caractères)`);
    console.log(`beIN SPORTS : Utah=${normalizedPage.includes("utahjazz")} Lakers=${normalizedPage.includes("losangeleslakers")}`);
  } catch (e) {
    console.warn("beIN SPORTS:", e.message);
  }
}

await Promise.all([football(),nba()]);
await addBeinBroadcasters();
out.sort((a,b)=>new Date(a.utc)-new Date(b.utc));
await fs.writeFile(new URL('./matches.json', import.meta.url), JSON.stringify(out,null,2)+'\n');
await fs.writeFile(new URL('./last-update.json', import.meta.url), JSON.stringify({updatedAt:new Date().toISOString(),count:out.length},null,2)+'\n');
console.log(`${out.length} matchs enregistrés`);
