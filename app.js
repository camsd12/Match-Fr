et matches = [];
let mode = "Foot";

const fmtDate = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "long",
  day: "numeric",
  month: "long"
});

const fmtTime = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit"
});

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function badge(x, fallback) {
  if (x && /^https?:/.test(x)) {
    return `
      <span class="badge">
        <img class="crest"
             src="${esc(x)}"
             alt=""
             onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
        <span style="display:none">${esc(fallback || "⚽")}</span>
      </span>
    `;
  }

  return `<span class="badge">${esc(x || fallback || "⚽")}</span>`;
}

function showFoot() {
  mode = "Foot";

  const matchesRoot = document.querySelector("#matches");
  const nbaWidget = document.querySelector("#nba-widget");

  if (matchesRoot) matchesRoot.style.display = "";
  if (nbaWidget) nbaWidget.style.display = "none";

  renderFoot();
}

function showNBA() {
  mode = "NBA";

  const matchesRoot = document.querySelector("#matches");
  const nbaWidget = document.querySelector("#nba-widget");

  if (matchesRoot) matchesRoot.style.display = "none";
  if (nbaWidget) nbaWidget.style.display = "";
}

function renderFoot() {
  const root = document.querySelector("#matches");
  if (!root) return;

  root.innerHTML = "";

  const football = matches.filter(x => x.sport !== "NBA");
  const groups = {};

  football.forEach(match => {
    const day = fmtDate.format(new Date(match.utc));

    if (!groups[day]) groups[day] = [];
    groups[day].push(match);
  });

  if (!football.length) {
    root.innerHTML =
      `<div class="empty">Aucun match de football trouvé.</div>`;
    return;
  }

  for (const [day, items] of Object.entries(groups)) {

    root.insertAdjacentHTML(
      "beforeend",
      `<h3 class="day">${esc(day)}</h3>`
    );

    items.forEach(match => {

      root.insertAdjacentHTML(
        "beforeend",
        `
        <article class="card">

          <div class="meta">
            <span>⚽ ${esc(match.comp)}</span>
            <span>🇫🇷 heure France</span>
          </div>

          <div class="teams">

            <div class="team">
              ${badge(match.homeIcon, "⚽")}
              <strong>${esc(match.home)}</strong>
            </div>

            <div class="kick">
              <strong>${fmtTime.format(new Date(match.utc))}</strong>
              <span>Paris</span>
            </div>

            <div class="team">
              ${badge(match.awayIcon, "⚽")}
              <strong>${esc(match.away)}</strong>
            </div>

          </div>

          <div class="tv">
            📺 ${esc(match.tv || "Diffuseur à confirmer")}
          </div>

        </article>
        `
      );
    });
  }
}

async function load() {

  const updated = document.querySelector("#updated");

  if (updated) {
    updated.textContent = "Mise à jour...";
  }

  try {

    const response = await fetch(
      "./matches.json?" + Date.now(),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(response.status);
    }

    matches = await response.json();

    const infoResponse = await fetch(
      "./last-update.json?" + Date.now(),
      { cache: "no-store" }
    );

    if (infoResponse.ok) {
      const info = await infoResponse.json();

      if (updated && info.updatedAt) {
        updated.textContent =
          "Données mises à jour · " +
          new Date(info.updatedAt).toLocaleString(
            "fr-FR",
            { timeZone: "Europe/Paris" }
          );
      }
    }

  } catch (e) {

    console.error(e);

    if (updated) {
      updated.textContent = "Mise à jour indisponible";
    }
  }

  showFoot();
}

document.querySelectorAll(".tabs button").forEach(button => {

  button.onclick = () => {

    document
      .querySelectorAll(".tabs button")
      .forEach(b => b.classList.remove("active"));

    button.classList.add("active");

    const filter = button.dataset.filter;

    if (filter === "NBA") {
      showNBA();
    } else {
      showFoot();
    }
  };
});

const refresh = document.querySelector("#refresh");

if (refresh) {
  refresh.onclick = load;
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

load();

setInterval(load, 300000);

