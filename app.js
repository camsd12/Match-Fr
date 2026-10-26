let matches = [];

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

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function badge(value, fallback = "⚽") {
  if (value && /^https?:/.test(value)) {
    return `
      <span class="badge">
        <img
          class="crest"
          src="${esc(value)}"
          alt=""
          onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"
        >
        <span style="display:none">${fallback}</span>
      </span>
    `;
  }

  return `<span class="badge">${fallback}</span>`;
}

function renderFoot() {
  const root = document.querySelector("#matches");
  if (!root) return;

  root.innerHTML = "";

  const football = matches
    .filter(match => match.sport !== "NBA")
    .sort((a, b) => new Date(a.utc) - new Date(b.utc));

  if (!football.length) {
    root.innerHTML = `<div class="empty">Aucun match de football disponible.</div>`;
    return;
  }

  const groups = {};

  football.forEach(match => {
    const day = fmtDate.format(new Date(match.utc));
    if (!groups[day]) groups[day] = [];
    groups[day].push(match);
  });

  Object.entries(groups).forEach(([day, games]) => {
    root.insertAdjacentHTML(
      "beforeend",
      `<h3 class="day">${esc(day)}</h3>`
    );

    games.forEach(match => {
      const time = fmtTime.format(new Date(match.utc));

      root.insertAdjacentHTML(
        "beforeend",
        `
        <article class="card">
          <div class="meta">
            <span>⚽ ${esc(match.comp || "Football")}</span>
            <span>🇫🇷 heure France</span>
          </div>

          <div class="teams">
            <div class="team">
              ${badge(match.homeIcon, "⚽")}
              <strong>${esc(match.home)}</strong>
            </div>

            <div class="kickoff">
              <strong>${esc(time)}</strong>
              <small>Paris</small>
            </div>

            <div class="team">
              ${badge(match.awayIcon, "⚽")}
              <strong>${esc(match.away)}</strong>
            </div>
          </div>

          <div class="tv">
            📺 ${esc(match.tv || "Diffuseur FR à confirmer")}
          </div>
        </article>
        `
      );
    });
  });
}

async function loadFootball() {
  const updated = document.querySelector("#updated");

  if (updated) {
    updated.textContent = "Chargement...";
  }

  try {
    const response = await fetch(
      "./matches.json?v=" + Date.now(),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    matches = await response.json();

    renderFoot();

    try {
      const updateResponse = await fetch(
        "./last-update.json?v=" + Date.now(),
        { cache: "no-store" }
      );

      if (updateResponse.ok) {
        const info = await updateResponse.json();

        if (updated && info.updatedAt) {
          updated.textContent =
            "Mis à jour " +
            new Date(info.updatedAt).toLocaleString("fr-FR", {
              timeZone: "Europe/Paris",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit"
            });
        }
      }
    } catch {
      if (updated) updated.textContent = "Données à jour";
    }

  } catch (error) {
    console.error("Erreur chargement football :", error);

    if (updated) {
      updated.textContent = "Mise à jour indisponible";
    }
  }
}

function showFoot() {
  document.querySelector("#foot-section").style.display = "";
  document.querySelector("#nba-section").style.display = "none";

  document.querySelector("#footBtn").classList.add("active");
  document.querySelector("#nbaBtn").classList.remove("active");
}

function showNBA() {
  document.querySelector("#foot-section").style.display = "none";
  document.querySelector("#nba-section").style.display = "";

  document.querySelector("#footBtn").classList.remove("active");
  document.querySelector("#nbaBtn").classList.add("active");
}

document.querySelector("#footBtn").onclick = showFoot;
document.querySelector("#nbaBtn").onclick = showNBA;
document.querySelector("#refresh").onclick = loadFootball;

showFoot();
loadFootball();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(error => {
    console.warn("Service Worker :", error);
  });
}
