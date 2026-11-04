// app.js — beží v mobile (v Safari), nie na notebooku.

// ---------------------------------------------------------------------------
// 1. Domov: dátum a pozdrav
// ---------------------------------------------------------------------------
const today = new Date();
document.getElementById("date").textContent = today.toLocaleDateString("sk-SK", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const hour = today.getHours();
let greeting = "Ahoj, Adam";
if (hour < 10) {
  greeting = "Dobré ráno, Adam";
} else if (hour >= 18) {
  greeting = "Dobrý večer, Adam";
}
document.getElementById("greeting").textContent = greeting;

// ---------------------------------------------------------------------------
// 2. Je notebook (server) dostupný?
// ---------------------------------------------------------------------------
const statusEl = document.getElementById("status");
const statusText = document.getElementById("status-text");

async function checkServer() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("server odpovedal chybou");
    }
    statusEl.className = "status online";
    statusText.textContent = "Notebook je pripojený";
    return true;
  } catch (error) {
    statusEl.className = "status offline";
    statusText.textContent = "Notebook nie je dostupný";
    return false;
  }
}

// ---------------------------------------------------------------------------
// 3. Termíny
// ---------------------------------------------------------------------------
const CACHE_KEY = "terminy"; // pod týmto menom si mobil pamätá posledné termíny

// koľko dní zostáva od dneška do dátumu "2026-11-10"
function daysUntil(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(y, m - 1, d);                                   // polnoc v ten deň
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()); // dnešná polnoc
  return Math.round((target - start) / 86400000);                         // 86 400 000 ms = 1 deň
}

// 0 → "dnes", 1 → "zajtra", 5 → "o 5 dní"
function countdownText(days) {
  if (days === 0) return "dnes";
  if (days === 1) return "zajtra";
  if (days >= 2 && days <= 4) return `o ${days} dni`;
  return `o ${days} dní`;
}

// "2026-11-10" + "09:10" → "utorok 10. 11. · 9:10"
function whenText(t) {
  const [y, m, d] = t.date.split("-").map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString("sk-SK", { weekday: "long" });
  let text = `${day} ${d}. ${m}.`;
  if (t.time) {
    text += ` · ${t.time.replace(/^0/, "")}`;
  }
  if (t.weekly) {
    text += " · každý týždeň";
  }
  return text;
}

// Bezpečné vloženie textu: textContent namiesto innerHTML,
// aby sa text z poznámok nikdy nespustil ako kód.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderTerminy(data, fromCache) {
  const list = document.getElementById("terminy-list");
  list.replaceChildren(); // vymaž starý obsah

  // kedy boli dáta naposledy stiahnuté
  const updated = new Date(data.updated).toLocaleString("sk-SK", {
    day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
  });
  document.getElementById("terminy-updated").textContent = fromCache
    ? `Offline — posledné dáta z ${updated}`
    : `Aktualizované ${updated} z Obsidianu`;

  // vynecháme termíny, ktoré medzitým prešli (dôležité pri offline dátach)
  const terminy = data.terminy.filter((t) => daysUntil(t.date) >= 0);

  if (terminy.length === 0) {
    list.append(el("li", "empty", "Žiadne nadchádzajúce termíny 🎉"));
    return;
  }

  for (const t of terminy) {
    const days = daysUntil(t.date);
    const li = el("li", "item");
    if (t.done) li.classList.add("done");
    else if (days <= 2) li.classList.add("soon");
    else if (days <= 7) li.classList.add("week");

    // ľavý štvorček s počtom dní
    const count = el("div", "count");
    count.append(el("b", "", days === 0 ? "!" : String(days)));
    count.append(el("span", "", days === 0 ? "dnes" : days === 1 ? "deň" : days <= 4 ? "dni" : "dní"));

    // pravá časť s textom
    const body = el("div");
    body.append(el("p", "item-title", t.title));
    body.append(el("p", "item-when", `${countdownText(days)} · ${whenText(t)}`));
    if (t.detail) body.append(el("p", "item-detail", t.detail));

    const tags = el("div", "tags");
    if (t.points) tags.append(el("span", "tag", `${t.points} b`));
    if (t.uncertain) tags.append(el("span", "tag warn", "dátum neoverený"));
    if (t.done) tags.append(el("span", "tag ok", "hotovo ✓"));
    if (tags.children.length) body.append(tags);

    li.append(count, body);
    list.append(li);
  }
}

// najbližší nehotový termín → na dlaždicu na domovskej obrazovke
function renderNextOnTile(data) {
  const next = data.terminy.find((t) => !t.done && !t.weekly && daysUntil(t.date) >= 0);
  const sub = document.getElementById("next-deadline");
  sub.textContent = next ? `${next.title} · ${countdownText(daysUntil(next.date))}` : "nič nehorí 🎉";
}

async function loadTerminy() {
  try {
    const response = await fetch("/api/terminy", { cache: "no-store" });
    if (!response.ok) throw new Error("server odpovedal chybou");
    const data = await response.json();
    // zapamätaj si ich v mobile pre prípad, že notebook bude vypnutý
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* plná pamäť / súkromný režim */ }
    renderTerminy(data, false);
    renderNextOnTile(data);
  } catch (error) {
    // notebook nie je dostupný → ukáž posledné uložené termíny
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { cached = null; }
    if (cached) {
      renderTerminy(cached, true);
      renderNextOnTile(cached);
    } else {
      document.getElementById("terminy-updated").textContent =
        "Termíny sa nedajú načítať — notebook nie je dostupný a v mobile ešte nič uložené nie je.";
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Prepínanie obrazoviek podľa adresy (#terminy, # = domov)
// ---------------------------------------------------------------------------
const views = {
  "": document.getElementById("view-home"),
  terminy: document.getElementById("view-terminy"),
};

function showView() {
  const name = location.hash.replace("#", "");
  const target = views[name] ? name : ""; // neznáma obrazovka → domov
  for (const key in views) {
    views[key].hidden = key !== target;
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", showView);

// ---------------------------------------------------------------------------
// 5. Štart
// ---------------------------------------------------------------------------
showView();
checkServer();
loadTerminy();

// každých 30 s skontroluj server; keď sa appka vráti z pozadia, obnov termíny
setInterval(checkServer, 30000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    checkServer();
    loadTerminy();
  }
});
