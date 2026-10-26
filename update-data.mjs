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
    console.log("📺 Vérification NBA beIN : J à J+2...");

    const response = await fetch("https://tv-sports.fr/basket/nba");

    if (!response.ok) {
      console.warn(`TV-Sports : HTTP ${response.status}`);
      return;
    }

    const html = await response.text();

    // Transforme le HTML en texte tout en gardant des séparations.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/?(?:h1|h2|h3|li|div|p|article|section|br)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&#39;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/[ \t]+/g, " ")
      .replace(/\n+/g, "\n");

    const nbaMatches = out.filter(m => m.sport === "NBA");

    // --------------------------------------------------
    // Dates J, J+1 et J+2 en heure française
    // --------------------------------------------------

    function parisDateKey(date) {
      const parts = new Intl.DateTimeFormat("fr-CA", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(date);

      const year = parts.find(p => p.type === "year")?.value;
      const month = parts.find(p => p.type === "month")?.value;
      const day = parts.find(p => p.type === "day")?.value;

      return `${year}-${month}-${day}`;
    }

    function parisDateLabel(date) {
      return new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(date);
    }

    const now = new Date();

    // On construit les trois dates à partir de midi pour
    // éviter les problèmes liés au changement d'heure.
    const todayParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);

    const year = Number(
      todayParts.find(p => p.type === "year")?.value
    );

    const month = Number(
      todayParts.find(p => p.type === "month")?.value
    );

    const day = Number(
      todayParts.find(p => p.type === "day")?.value
    );

    const days = [];

    for (let offset = 0; offset <= 2; offset++) {
      const d = new Date(
        Date.UTC(year, month - 1, day + offset, 12, 0, 0)
      );

      days.push({
        key: parisDateKey(d),
        label: parisDateLabel(d)
      });
    }

    console.log(
      `📅 Journées contrôlées : ${days
        .map(d => d.label)
        .join(" | ")}`
    );

    // --------------------------------------------------
    // Normalisation des noms d'équipes
    // --------------------------------------------------

    function normal(name) {
      return String(name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
    }

    const aliases = {
      laclippers: "losangelesclippers",
      losangelesclippers: "losangelesclippers",

      portlandtrailblazers: "portlandtrailblazers",

      philadelphia76ers: "philadelphia76ers",

      oklahomacitythunder: "oklahomacitythunder",

      goldenstatewarriors: "goldenstatewarriors",

      newyorkknicks: "newyorkknicks",

      sanantoniospurs: "sanantoniospurs"
    };

    function teamKey(name) {
      const key = normal(name);
      return aliases[key] || key;
    }

    // --------------------------------------------------
    // Découpage de la page par journée
    // --------------------------------------------------

    const monthNames =
      "janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre";

    const dateRegex = new RegExp(
      `(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\\s+` +
      `(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})`,
      "gi"
    );

    const headers = [];
    let dateMatch;

    while ((dateMatch = dateRegex.exec(text)) !== null) {
      headers.push({
        index: dateMatch.index,
        label: dateMatch[0]
      });
    }

    let confirmedCount = 0;

    // --------------------------------------------------
    // Analyse uniquement J, J+1 et J+2
    // --------------------------------------------------

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];

      const nextIndex =
        i + 1 < headers.length
          ? headers[i + 1].index
          : text.length;

      const dayBlock = text.slice(
        header.index,
        nextIndex
      );

      const headerDate = header.label.match(
        /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i
      );

      if (!headerDate) continue;

      const monthMap = {
        janvier: 1,
        février: 2,
        mars: 3,
        avril: 4,
        mai: 5,
        juin: 6,
        juillet: 7,
        août: 8,
        septembre: 9,
        octobre: 10,
        novembre: 11,
        décembre: 12
      };

      const dd = String(Number(headerDate[1])).padStart(2, "0");
      const mm = String(
        monthMap[headerDate[2].toLowerCase()]
      ).padStart(2, "0");

      const yyyy = headerDate[3];

      const dayKey = `${yyyy}-${mm}-${dd}`;

      // On ignore tout ce qui n'est pas J, J+1 ou J+2.
      if (!days.some(d => d.key === dayKey)) {
        continue;
      }

      console.log(`📅 Analyse TV : ${dayKey}`);

      // ------------------------------------------------
      // Chaque émission commence par une heure suivie
      // de Direct ou Rediffusion.
      // ------------------------------------------------

      const eventRegex =
        /(\d{1,2})h(\d{2})\s+(Direct|Rediffusion(?:\s+Rediff\.)?)/gi;

      const events = [];
      let eventMatch;

      while ((eventMatch = eventRegex.exec(dayBlock)) !== null) {
        events.push({
          index: eventMatch.index,
          hour: Number(eventMatch[1]),
          minute: Number(eventMatch[2]),
          type: eventMatch[3]
        });
      }

      for (let e = 0; e < events.length; e++) {
        const event = events[e];

        const eventEnd =
          e + 1 < events.length
            ? events[e + 1].index
            : dayBlock.length;

        const eventBlock = dayBlock.slice(
          event.index,
          eventEnd
        );

        // ----------------------------------------------
        // RÈGLE IMPORTANTE :
        // uniquement les DIRECTS.
        // ----------------------------------------------

        if (!/^Direct$/i.test(event.type.trim())) {
          continue;
        }

        // NBA uniquement.
        if (!/\bNBA\b/i.test(eventBlock)) {
          continue;
        }

        // beIN uniquement.
        const channelMatch = eventBlock.match(
          /beIN SPORTS(?:\s+MAX)?(?:\s+\d+)?/i
        );

        if (!channelMatch) {
          continue;
        }

        const channel = channelMatch[0]
          .replace(/\s+/g, " ")
          .trim();

        // ----------------------------------------------
        // Trouve l'affiche située dans ce bloc.
        // ----------------------------------------------

        const lines = eventBlock
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean);

        const matchupLine = lines.find(line =>
          /[–-]/.test(line) &&
          !/beIN SPORTS/i.test(line)
        );

        if (!matchupLine) {
          continue;
        }

        const teams = matchupLine.split(/\s+[–-]\s+/);

        if (teams.length !== 2) {
          continue;
        }

        const tvHome = teams[0].trim();
        const tvAway = teams[1].trim();

        const tvHomeKey = teamKey(tvHome);
        const tvAwayKey = teamKey(tvAway);

        // ----------------------------------------------
        // Cherche le même match dans Match FR.
        // ----------------------------------------------

        for (const match of nbaMatches) {
          const matchDate = new Date(match.utc);

          if (Number.isNaN(matchDate.valueOf())) {
            continue;
          }

          // Le match doit appartenir à la même journée
          // française 00:00 -> 00:00.
          if (parisDateKey(matchDate) !== dayKey) {
            continue;
          }

          const appHome = teamKey(match.home);
          const appAway = teamKey(match.away);

          const sameOrder =
            appHome === tvHomeKey &&
            appAway === tvAwayKey;

          const reverseOrder =
            appHome === tvAwayKey &&
            appAway === tvHomeKey;

          if (!sameOrder && !reverseOrder) {
            continue;
          }

          // --------------------------------------------
          // Vérification de l'heure française.
          // --------------------------------------------

          const timeParts = new Intl.DateTimeFormat(
            "fr-FR",
            {
              timeZone: "Europe/Paris",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false
            }
          ).formatToParts(matchDate);

          const appHour = Number(
            timeParts.find(p => p.type === "hour")?.value
          );

          const appMinute = Number(
            timeParts.find(p => p.type === "minute")?.value
          );

          const appTotal =
            appHour * 60 + appMinute;

          const tvTotal =
            event.hour * 60 + event.minute;

          const difference =
            Math.abs(appTotal - tvTotal);

          // Tolérance maximale : 30 minutes.
          if (difference > 30) {
            console.log(
              `⚠️ Match trouvé mais heure différente : ${match.home} - ${match.away}`
            );

            continue;
          }

          // --------------------------------------------
          // CONFIRMÉ
          // --------------------------------------------

          match.tv =
            `${channel} • NBA League Pass`;

          console.log(
            `📺 ${channel} confirmé : ` +
            `${match.home} - ${match.away} ` +
            `(${String(event.hour).padStart(2, "0")}:${String(event.minute).padStart(2, "0")})`
          );

          confirmedCount++;
          break;
        }
      }
    }

    console.log(
      `📺 ${confirmedCount} match(s) NBA beIN confirmé(s) sur J à J+2`
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
